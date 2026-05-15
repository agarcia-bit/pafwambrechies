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

HALF_HOURS = [h / 2 for h in range(19, 49)]


def solve_planning(req: SolverRequest) -> SolverResponse:
    start_time = time.time()
    model = cp_model.CpModel()

    working_days = [1, 2, 3, 4, 5, 6]
    non_managers = [e for e in req.employees if not e.is_manager]
    salle_employees = [e for e in non_managers if e.department == "salle"]
    kitchen_employees = [e for e in non_managers if e.department == "cuisine"]
    managers = [e for e in req.employees if e.is_manager]

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

    fixed_unavail: dict[str, set[int]] = {}
    punctual_unavail: dict[str, dict[int, dict]] = {}
    # Réductions d'heures par salarié (somme des hours_reduction de ses indispos ponctuelles)
    hours_reductions: dict[str, float] = {}
    for u in req.unavailabilities:
        if u.type == "fixed" and u.day_of_week is not None:
            fixed_unavail.setdefault(u.employee_id, set()).add(u.day_of_week)
        elif u.type == "punctual" and u.specific_date:
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
            # Accumule la réduction d'heures
            if u.hours_reduction and u.hours_reduction > 0:
                hours_reductions[u.employee_id] = hours_reductions.get(u.employee_id, 0) + u.hours_reduction

    cond_avail: dict[str, dict[int, dict]] = {}
    for ca in req.conditional_availabilities:
        cond_avail.setdefault(ca.employee_id, {})[ca.day_of_week] = {
            "codes": set(ca.allowed_shift_codes),
            "max_hours": ca.max_hours,
        }

    x: dict[tuple[str, int, str], cp_model.IntVar] = {}
    for emp in non_managers:
        for day in working_days:
            if day in fixed_unavail.get(emp.id, set()):
                continue
            for shift in shifts_for_day(day, emp.department):
                if emp.id in cond_avail and day in cond_avail[emp.id]:
                    ca = cond_avail[emp.id][day]
                    if shift.code not in ca["codes"]:
                        continue
                    if ca["max_hours"] and shift.effective_hours > ca["max_hours"]:
                        continue
                if emp.id in punctual_unavail and day in punctual_unavail[emp.id]:
                    pu = punctual_unavail[emp.id][day]
                    if pu["from"] is not None and shift.start_time < pu["from"]:
                        continue
                    if pu["until"] is not None and shift.end_time > pu["until"]:
                        continue
                x[(emp.id, day, shift.id)] = model.new_bool_var(f"x_{emp.id}_{day}_{shift.id}")

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

    # 3. Max N working days
    for emp in non_managers:
        emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
        if emp_days:
            model.add(sum(emp_days) <= req.max_working_days)

    # 4. Full-time must work exactly max_working_days
    #    SAUF si une réduction d'heures est appliquée (le salarié peut travailler moins)
    for emp in non_managers:
        if emp.weekly_hours >= req.fulltime_threshold:
            reduction = hours_reductions.get(emp.id, 0)
            if reduction <= 0:
                emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
                if emp_days:
                    model.add(sum(emp_days) >= req.max_working_days)

    # 5. Repos min entre jours consécutifs
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
                    if rest < req.min_rest_hours:
                        model.add(x[k1] + x[k2] <= 1)

    # 6. Contract hours bounds
    #    Ajusté par hours_reductions si le salarié a des indispos ponctuelles
    for emp in non_managers:
        emp_hours = []
        for k in x:
            if k[0] == emp.id:
                s = shift_map[k[2]]
                emp_hours.append((x[k], int(s.effective_hours * 10)))
        if emp_hours:
            total = sum(v * h for v, h in emp_hours)
            reduction = hours_reductions.get(emp.id, 0)
            adjusted_weekly = max(0, emp.weekly_hours - reduction)
            min_hours = int(adjusted_weekly * 10)
            max_hours = int((emp.weekly_hours + emp.modulation_range) * 10)
            model.add(total >= min_hours)
            model.add(total <= max_hours)

    salle_ids = {e.id for e in salle_employees}

    emp_level = {e.id: e.level for e in req.employees}
    for day in working_days:
        opening_vars = []
        opening_keys = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.start_time <= 9.5:
                    opening_vars.append(x[k])
                    opening_keys.append(k)
        manager_covers = any(
            ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.start_time <= 9.5
            for ms in req.manager_schedules
        )
        if opening_vars and not manager_covers:
            model.add(sum(opening_vars) >= 1)

    penalties = []

    for k, var in x.items():
        emp_id, day, shift_id = k
        if emp_id not in salle_ids:
            continue
        s = shift_map[shift_id]
        if s.start_time <= 9.5:
            level = emp_level.get(emp_id, 1)
            weight = int((level - 1) * 3)
            if weight > 0:
                penalties.append(var * weight)

    user_visible_shortfalls = []

    for day in working_days:
        min_closing = req.min_closing_weekday if day < req.weekend_start_day else req.min_closing_weekend
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        closing_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map[k[2]]
                if s.end_time >= closing_time:
                    closing_vars.append(x[k])
        manager_closing = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.end_time is not None and ms.end_time >= closing_time)
        needed = max(0, min_closing - manager_closing)
        if closing_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"close_short_{day}")
            model.add(sum(closing_vars) + shortfall >= needed)
            penalties.append(shortfall * 50)
            user_visible_shortfalls.append(shortfall)

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
            mgr_present = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= h and ms.end_time > h)
            needed = max(0, 2 - mgr_present)
            if present and needed > 0:
                gap = model.new_int_var(0, needed, f"cov_gap_{day}_{h_idx}")
                model.add(sum(present) + gap >= needed)
                penalties.append(gap * 20)
                user_visible_shortfalls.append(gap)

    for day_str, min_count in req.min_staff_midi.items():
        if min_count <= 0: continue
        day = int(day_str)
        midi_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map[k[2]].start_time <= 12 and shift_map[k[2]].end_time >= 15]
        mgr_midi = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= 12 and ms.end_time >= 15)
        needed = max(0, min_count - mgr_midi)
        if midi_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"midi_short_{day}")
            model.add(sum(midi_vars) + shortfall >= needed)
            penalties.append(shortfall * 40)

    for day_str, min_count in req.min_staff_soir.items():
        if min_count <= 0: continue
        day = int(day_str)
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        soir_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map[k[2]].start_time <= 18 and shift_map[k[2]].end_time >= closing_time]
        mgr_soir = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= 18 and ms.end_time >= closing_time)
        needed = max(0, min_count - mgr_soir)
        if soir_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"soir_short_{day}")
            model.add(sum(soir_vars) + shortfall >= needed)
            penalties.append(shortfall * 40)

    for day_str, min_count in req.min_staff_fermeture.items():
        if min_count <= 0: continue
        day = int(day_str)
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        ferm_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map[k[2]].end_time >= closing_time]
        mgr_ferm = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.end_time is not None and ms.end_time >= closing_time)
        needed = max(0, min_count - mgr_ferm)
        if ferm_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"ferm_short_{day}")
            model.add(sum(ferm_vars) + shortfall >= needed)
            penalties.append(shortfall * 50)

    for emp in non_managers:
        for day in working_days:
            next_day = day + 1
            if next_day > 6: continue
            for shift in req.shift_templates:
                k1 = (emp.id, day, shift.id)
                k2 = (emp.id, next_day, shift.id)
                if k1 in x and k2 in x:
                    both = model.new_bool_var(f"same_{emp.id}_{day}_{shift.id}")
                    model.add(x[k1] + x[k2] - 1 <= both)
                    penalties.append(both * 5)

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

    day_forecasts = {f.day_of_week: f.forecasted_revenue for f in req.day_forecasts}
    for ov in req.event_overrides:
        if ov.day_of_week in day_forecasts:
            day_forecasts[ov.day_of_week] *= (1 + ov.revenue_multiplier_percent / 100)

    for day in working_days:
        ca = day_forecasts.get(day, 0)
        if ca <= 0: continue
        target_hours_10 = int(ca / req.productivity_target * 10)
        day_hour_terms = [(x[k], int(shift_map[k[2]].effective_hours * 10)) for k in x if k[1] == day and k[0] in salle_ids]
        mgr_hours_10 = sum(int(((ms.end_time or 0) - (ms.start_time or 0)) * 10) for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id)
        if day_hour_terms:
            day_total = sum(v * h for v, h in day_hour_terms) + mgr_hours_10
            over = model.new_int_var(0, 5000, f"prod_over_{day}")
            under = model.new_int_var(0, 5000, f"prod_under_{day}")
            model.add(day_total - target_hours_10 <= over)
            model.add(target_hours_10 - day_total <= under)
            ca_weight = max(1, int(ca / 1000))
            penalties.append(over * ca_weight)
            penalties.append(under * ca_weight * 2)

    if penalties:
        model.minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.num_workers = 4

    best_status = None
    best_shortfalls = float('inf')
    best_objective = float('inf')
    best_solver = solver
    max_attempts = 3

    for attempt in range(max_attempts):
        if attempt > 0:
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 10.0
            solver.parameters.num_workers = 4
            solver.parameters.random_seed = attempt * 42
        status = solver.solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            if best_status is None: best_status = status
            continue
        total_shortfalls = sum(solver.value(v) for v in user_visible_shortfalls)
        obj = solver.objective_value
        is_better = (best_status is None or total_shortfalls < best_shortfalls or (total_shortfalls == best_shortfalls and obj < best_objective))
        if is_better:
            best_shortfalls = total_shortfalls
            best_objective = obj
            best_solver = solver
            best_status = status
        if total_shortfalls == 0: break
        if status == cp_model.OPTIMAL: break

    solver = best_solver
    status = best_status
    solve_time = int((time.time() - start_time) * 1000)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResponse(success=False, status="INFEASIBLE", solve_time_ms=solve_time, warnings=["Aucune solution trouvée. Vérifiez les contraintes."])

    entries: list[ShiftAssignment] = []
    for ms in req.manager_schedules:
        if not ms.shift_template_id: continue
        s = shift_map.get(ms.shift_template_id)
        start = ms.start_time if ms.start_time is not None else (s.start_time if s else 0)
        end = ms.end_time if ms.end_time is not None else (s.end_time if s else 0)
        entries.append(ShiftAssignment(employee_id=ms.employee_id, day_of_week=ms.day_of_week, shift_template_id=ms.shift_template_id, start_time=start, end_time=end, effective_hours=end - start, meals=s.meals if s else 0, baskets=s.baskets if s else 0))

    for k, var in x.items():
        if solver.value(var) == 1:
            emp_id, day, shift_id = k
            s = shift_map[shift_id]
            entries.append(ShiftAssignment(employee_id=emp_id, day_of_week=day, shift_template_id=shift_id, start_time=s.start_time, end_time=s.end_time, effective_hours=s.effective_hours, meals=s.meals, baskets=s.baskets))

    warnings = []
    status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
    if status == cp_model.FEASIBLE:
        warnings.append("Solution faisable mais pas optimale (timeout 10s)")

    return SolverResponse(success=True, entries=entries, status=status_str, solve_time_ms=solve_time, warnings=warnings)


def _add_days(iso_date: str, days: int) -> str:
    from datetime import datetime, timedelta
    d = datetime.fromisoformat(iso_date) + timedelta(days=days)
    return d.strftime("%Y-%m-%d")
