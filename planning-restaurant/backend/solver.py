"""
Planning solver using Google OR-Tools CP-SAT.

Variables:
  x[e, d, s] = 1 if employee e works shift s on day d

Hard constraints:
  - Each employee works at most 1 shift per day
  - Respect unavailabilities (fixed + punctual)
  - Respect conditional availabilities (allowed shift codes)
  - Repos 11h between consecutive days
  - Max 5 working days per week (full-time)
  - Contract bounds: min <= total_hours <= max
  - Manager fixed schedules
  - 1 person at opening (9h30) every day

Soft constraints (objectives to maximize/minimize):
  - Minimize deviation from contract hours (never below base contract)
  - Coverage: ≥2 people from 11h to closing
  - Closing: 4 Tue-Wed, 6 Thu-Sun
  - Shift variety per employee
  - Productivity close to target
"""
import time
from ortools.sat.python import cp_model
from models import SolverRequest, SolverResponse, ShiftAssignment

# Time slots for coverage checking (every 30min from 9.5 to 24)
HALF_HOURS = [h / 2 for h in range(19, 49)]  # 9.5, 10.0, ..., 24.0


def solve_planning(req: SolverRequest) -> SolverResponse:
    start_time = time.time()
    model = cp_model.CpModel()

    # --- Data prep ---
    working_days = [1, 2, 3, 4, 5, 6]  # Tue-Sun (0=Mon=closed)
    non_managers = [e for e in req.employees if not e.is_manager]
    salle_employees = [e for e in non_managers if e.department == "salle"]
    kitchen_employees = [e for e in non_managers if e.department == "cuisine"]
    managers = [e for e in req.employees if e.is_manager]

    # Shift templates by day applicability and department
    def shifts_for_day(day: int, department: str = "salle") -> list:
        result = []
        for s in req.shift_templates:
            if s.department != department:
                continue
            if day == 6 and s.applicability == "sunday":
                result.append(s)
            elif day == 5 and s.applicability in ("tue_sat", "sat_only"):
                result.append(s)
            elif day < 5 and s.applicability == "tue_sat":
                result.append(s)
        return result

    # Build unavailability sets
    fixed_unavail: dict[str, set[int]] = {}  # emp_id -> set of days
    punctual_unavail: dict[str, dict[int, dict]] = {}  # emp_id -> day -> {from, until}
    for u in req.unavailabilities:
        if u.type == "fixed" and u.day_of_week is not None:
            fixed_unavail.setdefault(u.employee_id, set()).add(u.day_of_week)
        elif u.type == "punctual" and u.specific_date:
            # Convert date to day_of_week
            for d in working_days:
                date = _add_days(req.week_start_date, d)
                if date == u.specific_date:
                    if u.available_from is None and u.available_until is None:
                        fixed_unavail.setdefault(u.employee_id, set()).add(d)
                    else:
                        punctual_unavail.setdefault(u.employee_id, {})[d] = {
                            "from": u.available_from,
                            "until": u.available_until,
                        }

    # Conditional availabilities
    cond_avail: dict[str, dict[int, dict]] = {}  # emp_id -> day -> {codes, max_hours}
    for ca in req.conditional_availabilities:
        cond_avail.setdefault(ca.employee_id, {})[ca.day_of_week] = {
            "codes": set(ca.allowed_shift_codes),
            "max_hours": ca.max_hours,
        }

    # --- Variables ---
    # x[e_id, day, s_id] = BoolVar
    x: dict[tuple[str, int, str], cp_model.IntVar] = {}
    for emp in non_managers:
        for day in working_days:
            if day in fixed_unavail.get(emp.id, set()):
                continue
            for shift in shifts_for_day(day, emp.department):
                # Check conditional availability
                if emp.id in cond_avail and day in cond_avail[emp.id]:
                    ca = cond_avail[emp.id][day]
                    if shift.code not in ca["codes"]:
                        continue
                    if ca["max_hours"] and shift.effective_hours > ca["max_hours"]:
                        continue

                # Check punctual time restrictions
                if emp.id in punctual_unavail and day in punctual_unavail[emp.id]:
                    pu = punctual_unavail[emp.id][day]
                    if pu["from"] is not None and shift.start_time < pu["from"]:
                        continue
                    if pu["until"] is not None and shift.end_time > pu["until"]:
                        continue

                x[(emp.id, day, shift.id)] = model.new_bool_var(
                    f"x_{emp.id}_{day}_{shift.id}"
                )

    # --- Hard Constraints ---

    # 1. At most 1 shift per employee per day
    for emp in non_managers:
        for day in working_days:
            day_vars = [x[k] for k in x if k[0] == emp.id and k[1] == day]
            if day_vars:
                model.add(sum(day_vars) <= 1)

    # 2. Working day indicator
    works_day: dict[tuple[str, int], cp_model.IntVar] = {}
    for emp in non_managers:
        for day in working_days:
            day_vars = [x[k] for k in x if k[0] == emp.id and k[1] == day]
            if day_vars:
                wd = model.new_bool_var(f"wd_{emp.id}_{day}")
                model.add(sum(day_vars) >= 1).only_enforce_if(wd)
                model.add(sum(day_vars) == 0).only_enforce_if(wd.negated())
                works_day[(emp.id, day)] = wd

    # 3. Max 5 working days
    for emp in non_managers:
        emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
        if emp_days:
            model.add(sum(emp_days) <= 5)

    # 4. Full-time must work exactly 5 days
    for emp in non_managers:
        if emp.weekly_hours >= 35:
            emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
            if emp_days:
                model.add(sum(emp_days) >= 5)

    # 5. Repos 11h between consecutive days
    shift_map = {s.id: s for s in req.shift_templates}
    for emp in non_managers:
        for day in working_days:
            next_day = day + 1
            if next_day > 6:
                continue
            for k1 in x:
                if k1[0] != emp.id or k1[1] != day:
                    continue
                s1 = shift_map[k1[2]]
                for k2 in x:
                    if k2[0] != emp.id or k2[1] != next_day:
                        continue
                    s2 = shift_map[k2[2]]
                    rest = 24 - s1.end_time + s2.start_time
                    if rest < 11:
                        # Cannot both be 1
                        model.add(x[k1] + x[k2] <= 1)

    # 6. Contract hours bounds
    for emp in non_managers:
        emp_hours = []
        for k in x:
            if k[0] == emp.id:
                s = shift_map[k[2]]
                emp_hours.append((x[k], int(s.effective_hours * 10)))  # ×10 for int

        if emp_hours:
            total = sum(v * h for v, h in emp_hours)
            min_hours = int(emp.weekly_hours * 10)  # Never below base contract
            max_hours = int((emp.weekly_hours + emp.modulation_range) * 10)
            model.add(total >= min_hours)
            model.add(total <= max_hours)

    # Salle employee IDs for coverage constraints
    salle_ids = {e.id for e in salle_employees}

    # 7. Opening: ≥1 person at 9h30 every day (salle only)
    for day in working_days:
        opening_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.start_time <= 9.5:
                    opening_vars.append(x[k])
        # Also check managers
        manager_covers = any(
            ms.day_of_week == day
            and ms.shift_template_id
            and ms.start_time is not None
            and ms.start_time <= 9.5
            for ms in req.manager_schedules
        )
        if opening_vars and not manager_covers:
            model.add(sum(opening_vars) >= 1)

    # --- Soft Constraints (Objectives) ---
    penalties = []

    # 8. Closing coverage: 4 Tue-Wed, 6 Thu-Sun
    for day in working_days:
        min_closing = 4 if day <= 2 else 6
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week

        closing_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.end_time >= closing_time:
                    closing_vars.append(x[k])
        # Count managers at closing
        manager_closing = sum(
            1
            for ms in req.manager_schedules
            if ms.day_of_week == day
            and ms.shift_template_id
            and ms.end_time is not None
            and ms.end_time >= closing_time
        )

        needed = max(0, min_closing - manager_closing)
        if closing_vars and needed > 0:
            # Soft: penalize shortfall
            shortfall = model.new_int_var(0, needed, f"close_short_{day}")
            model.add(sum(closing_vars) + shortfall >= needed)
            penalties.append(shortfall * 50)

    # 9. Continuous coverage ≥2 from 11h to closing
    for day in working_days:
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        for h_idx, h in enumerate(HALF_HOURS):
            if h < 11 or h >= closing_time:
                continue
            present = []
            for k in x:
                if k[1] == day and k[0] in salle_ids:
                    s = shift_map[k[2]]
                    if s.start_time <= h and s.end_time > h:
                        present.append(x[k])
            # Count managers present
            mgr_present = sum(
                1
                for ms in req.manager_schedules
                if ms.day_of_week == day
                and ms.shift_template_id
                and ms.start_time is not None
                and ms.end_time is not None
                and ms.start_time <= h
                and ms.end_time > h
            )
            needed = max(0, 2 - mgr_present)
            if present and needed > 0:
                gap = model.new_int_var(0, needed, f"cov_gap_{day}_{h_idx}")
                model.add(sum(present) + gap >= needed)
                penalties.append(gap * 20)

    # 9b. Manual minimum staff midi (12-15h)
    for day_str, min_count in req.min_staff_midi.items():
        if min_count <= 0:
            continue
        day = int(day_str)
        midi_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.start_time <= 12 and s.end_time >= 15:
                    midi_vars.append(x[k])
        mgr_midi = sum(1 for ms in req.manager_schedules
            if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None
            and ms.end_time is not None and ms.start_time <= 12 and ms.end_time >= 15)
        needed = max(0, min_count - mgr_midi)
        if midi_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"midi_short_{day}")
            model.add(sum(midi_vars) + shortfall >= needed)
            penalties.append(shortfall * 40)

    # 9c. Manual minimum staff soir (18h-closing)
    for day_str, min_count in req.min_staff_soir.items():
        if min_count <= 0:
            continue
        day = int(day_str)
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        soir_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.start_time <= 18 and s.end_time >= closing_time:
                    soir_vars.append(x[k])
        mgr_soir = sum(1 for ms in req.manager_schedules
            if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None
            and ms.end_time is not None and ms.start_time <= 18 and ms.end_time >= closing_time)
        needed = max(0, min_count - mgr_soir)
        if soir_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"soir_short_{day}")
            model.add(sum(soir_vars) + shortfall >= needed)
            penalties.append(shortfall * 40)

    # 9d. Manual minimum staff fermeture
    for day_str, min_count in req.min_staff_fermeture.items():
        if min_count <= 0:
            continue
        day = int(day_str)
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        ferm_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.end_time >= closing_time:
                    ferm_vars.append(x[k])
        mgr_ferm = sum(1 for ms in req.manager_schedules
            if ms.day_of_week == day and ms.shift_template_id and ms.end_time is not None
            and ms.end_time >= closing_time)
        needed = max(0, min_count - mgr_ferm)
        if ferm_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"ferm_short_{day}")
            model.add(sum(ferm_vars) + shortfall >= needed)
            penalties.append(shortfall * 50)

    # 10. Shift variety: penalize same shift on consecutive days
    for emp in non_managers:
        for day in working_days:
            next_day = day + 1
            if next_day > 6:
                continue
            for shift in req.shift_templates:
                k1 = (emp.id, day, shift.id)
                k2 = (emp.id, next_day, shift.id)
                if k1 in x and k2 in x:
                    both = model.new_bool_var(f"same_{emp.id}_{day}_{shift.id}")
                    model.add(x[k1] + x[k2] - 1 <= both)
                    penalties.append(both * 5)

    # 11. Prefer hours close to contract (minimize over/under)
    for emp in non_managers:
        emp_hours_terms = []
        for k in x:
            if k[0] == emp.id:
                s = shift_map[k[2]]
                emp_hours_terms.append((x[k], int(s.effective_hours * 10)))
        if emp_hours_terms:
            total = sum(v * h for v, h in emp_hours_terms)
            target = int(emp.weekly_hours * 10)
            diff = model.new_int_var(0, 500, f"hdiff_{emp.id}")
            model.add(total - target <= diff)
            model.add(target - total <= diff)
            penalties.append(diff * 2)

    # Minimize total penalties
    if penalties:
        model.minimize(sum(penalties))

    # --- Solve ---
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.num_workers = 4

    status = solver.solve(model)
    solve_time = int((time.time() - start_time) * 1000)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResponse(
            success=False,
            status="INFEASIBLE",
            solve_time_ms=solve_time,
            warnings=["Aucune solution trouvée. Vérifiez les contraintes."],
        )

    # --- Extract solution ---
    entries: list[ShiftAssignment] = []

    # Manager entries (fixed)
    for ms in req.manager_schedules:
        if not ms.shift_template_id:
            continue
        s = shift_map.get(ms.shift_template_id)
        start = ms.start_time if ms.start_time is not None else (s.start_time if s else 0)
        end = ms.end_time if ms.end_time is not None else (s.end_time if s else 0)
        entries.append(
            ShiftAssignment(
                employee_id=ms.employee_id,
                day_of_week=ms.day_of_week,
                shift_template_id=ms.shift_template_id,
                start_time=start,
                end_time=end,
                effective_hours=end - start,
                meals=s.meals if s else 0,
                baskets=s.baskets if s else 0,
            )
        )

    # Non-manager entries
    for k, var in x.items():
        if solver.value(var) == 1:
            emp_id, day, shift_id = k
            s = shift_map[shift_id]
            entries.append(
                ShiftAssignment(
                    employee_id=emp_id,
                    day_of_week=day,
                    shift_template_id=shift_id,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    effective_hours=s.effective_hours,
                    meals=s.meals,
                    baskets=s.baskets,
                )
            )

    warnings = []
    status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
    if status == cp_model.FEASIBLE:
        warnings.append("Solution faisable mais pas optimale (timeout 10s)")

    return SolverResponse(
        success=True,
        entries=entries,
        status=status_str,
        solve_time_ms=solve_time,
        warnings=warnings,
    )


def _add_days(iso_date: str, days: int) -> str:
    from datetime import datetime, timedelta

    d = datetime.fromisoformat(iso_date) + timedelta(days=days)
    return d.strftime("%Y-%m-%d")
