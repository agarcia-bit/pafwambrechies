"""
Planning solver using Google OR-Tools CP-SAT.
"""
import time
from ortools.sat.python import cp_model
from models import SolverRequest, SolverResponse, ShiftAssignment

HALF_HOURS = [h / 2 for h in range(19, 49)]

# --- Solver parameters ---
SOLVER_TIMEOUT_SECONDS = 10.0
SOLVER_MAX_ATTEMPTS = 3
SOLVER_NUM_WORKERS = 4
SOLVER_SEED_MULTIPLIER = 42

# --- Penalty weights ---
PENALTY_CLOSING = 50
PENALTY_COVERAGE = 20
PENALTY_MIDI = 40
PENALTY_SOIR = 40
PENALTY_FERMETURE = 50
PENALTY_VARIETY = 5
PENALTY_HOUR_DIFF = 2
PENALTY_LEVEL_OPENING = 3


def solve_planning(req: SolverRequest) -> SolverResponse:
    start_time = time.time()
    model = cp_model.CpModel()

    working_days = [1, 2, 3, 4, 5, 6]
    non_managers = [e for e in req.employees if not e.is_manager]
    salle_employees = [e for e in non_managers if e.department == "salle"]
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
            elif 1 <= day < 5 and s.applicability == "tue_sat":
                result.append(s)
        return result

    fixed_unavail: dict[str, set[int]] = {}
    punctual_unavail: dict[str, dict[int, dict]] = {}
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

    # Calcul du nb de jours disponibles par salarié (pour ajuster le min heures)
    def available_days_count(emp_id: str) -> int:
        off_days = fixed_unavail.get(emp_id, set())
        return len([d for d in working_days if d not in off_days])

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
                    if shift.code not in ca["codes"]: continue
                    if ca["max_hours"] and shift.effective_hours > ca["max_hours"]: continue
                if emp.id in punctual_unavail and day in punctual_unavail[emp.id]:
                    pu = punctual_unavail[emp.id][day]
                    if pu["from"] is not None and shift.start_time < pu["from"]: continue
                    if pu["until"] is not None and shift.end_time > pu["until"]: continue
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

    # 4. Full-time must work as many days as available
    #    (capé par max_working_days et par le nb de jours dispo)
    for emp in non_managers:
        if emp.weekly_hours >= req.fulltime_threshold:
            avail = available_days_count(emp.id)
            target_days = min(req.max_working_days, avail)
            emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
            if emp_days and target_days > 0:
                model.add(sum(emp_days) >= target_days)

    # 5. Repos min entre jours consécutifs
    shift_map = {s.id: s for s in req.shift_templates}
    for emp in non_managers:
        for day in working_days:
            next_day = day + 1
            if next_day > 6: continue
            for k1 in x:
                if k1[0] != emp.id or k1[1] != day: continue
                s1 = shift_map.get(k1[2])
                if not s1: continue
                for k2 in x:
                    if k2[0] != emp.id or k2[1] != next_day: continue
                    s2 = shift_map.get(k2[2])
                    if not s2: continue
                    rest = 24 - s1.end_time + s2.start_time
                    if rest < req.min_rest_hours:
                        model.add(x[k1] + x[k2] <= 1)

    # 6. Contract hours bounds
    #    Min heures ajusté proportionnellement aux jours disponibles.
    #    Si un salarié a des OFF ponctuels cette semaine, son min heures
    #    est réduit automatiquement (pas besoin de saisie manuelle).
    #    Ex: 35h contrat, 6 jours normaux, 1 OFF ponctuel = 5 jours dispo
    #        → min = 35 × 5/6 = 29.2h (arrondi bas)
    for emp in non_managers:
        emp_hours = []
        for k in x:
            if k[0] == emp.id:
                s = shift_map.get(k[2])
                if not s: continue
                emp_hours.append((x[k], int(s.effective_hours * 10)))
        if emp_hours:
            total = sum(v * h for v, h in emp_hours)
            avail = available_days_count(emp.id)
            ratio = avail / len(working_days) if working_days else 1
            adjusted_min = emp.weekly_hours * ratio
            min_hours = int(adjusted_min * 10)
            max_hours = int((emp.weekly_hours + emp.modulation_range) * 10)
            model.add(total >= min_hours)
            model.add(total <= max_hours)

    salle_ids = {e.id for e in salle_employees}
    emp_level = {e.id: e.level for e in req.employees}

    for day in working_days:
        opening_vars = []
        for k in x:
            if k[1] == day and k[0] in salle_ids:
                s = shift_map.get(k[2])
                if not s: continue
                if s.start_time <= 9.5:
                    opening_vars.append(x[k])
        manager_covers = any(ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.start_time <= 9.5 for ms in req.manager_schedules)
        if opening_vars and not manager_covers:
            model.add(sum(opening_vars) >= 1)

    penalties = []

    # Préfère bas niveaux à l'ouverture
    for k, var in x.items():
        emp_id, day, shift_id = k
        if emp_id not in salle_ids: continue
        s = shift_map.get(shift_id)
        if not s: continue
        if s.start_time <= 9.5:
            level = emp_level.get(emp_id, 1)
            weight = int((level - 1) * PENALTY_LEVEL_OPENING)
            if weight > 0:
                penalties.append(var * weight)

    user_visible_shortfalls = []

    # Closing coverage
    for day in working_days:
        min_closing = req.min_closing_weekday if day < req.weekend_start_day else req.min_closing_weekend
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        closing_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2]) and shift_map[k[2]].end_time >= closing_time]
        manager_closing = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.end_time is not None and ms.end_time >= closing_time)
        needed = max(0, min_closing - manager_closing)
        if closing_vars and needed > 0:
            shortfall = model.new_int_var(0, needed, f"close_short_{day}")
            model.add(sum(closing_vars) + shortfall >= needed)
            penalties.append(shortfall * PENALTY_CLOSING)
            user_visible_shortfalls.append(shortfall)

    # Continuous coverage ≥2
    for day in working_days:
        closing_time = req.closing_time_sunday if day == 6 else req.closing_time_week
        for h_idx, h in enumerate(HALF_HOURS):
            if h < 11 or h >= closing_time: continue
            present = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2]) and shift_map[k[2]].start_time <= h and shift_map[k[2]].end_time > h]
            mgr_present = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= h and ms.end_time > h)
            needed = max(0, 2 - mgr_present)
            if present and needed > 0:
                gap = model.new_int_var(0, needed, f"cov_gap_{day}_{h_idx}")
                model.add(sum(present) + gap >= needed)
                penalties.append(gap * PENALTY_COVERAGE)
                user_visible_shortfalls.append(gap)

    # Min staff midi/soir/fermeture
    for day_str, min_count in req.min_staff_midi.items():
        if min_count <= 0: continue
        try:
            day = int(day_str)
        except (ValueError, TypeError):
            continue
        midi_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2]) and shift_map[k[2]].start_time <= 12 and shift_map[k[2]].end_time >= 15]
        mgr = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= 12 and ms.end_time >= 15)
        needed = max(0, min_count - mgr)
        if midi_vars and needed > 0:
            sf = model.new_int_var(0, needed, f"midi_short_{day}")
            model.add(sum(midi_vars) + sf >= needed)
            penalties.append(sf * PENALTY_MIDI)

    for day_str, min_count in req.min_staff_soir.items():
        if min_count <= 0: continue
        try:
            day = int(day_str)
        except (ValueError, TypeError):
            continue
        ct = req.closing_time_sunday if day == 6 else req.closing_time_week
        soir_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2]) and shift_map[k[2]].start_time <= 18 and shift_map[k[2]].end_time >= ct]
        mgr = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.start_time is not None and ms.end_time is not None and ms.start_time <= 18 and ms.end_time >= ct)
        needed = max(0, min_count - mgr)
        if soir_vars and needed > 0:
            sf = model.new_int_var(0, needed, f"soir_short_{day}")
            model.add(sum(soir_vars) + sf >= needed)
            penalties.append(sf * PENALTY_SOIR)

    for day_str, min_count in req.min_staff_fermeture.items():
        if min_count <= 0: continue
        try:
            day = int(day_str)
        except (ValueError, TypeError):
            continue
        ct = req.closing_time_sunday if day == 6 else req.closing_time_week
        ferm_vars = [x[k] for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2]) and shift_map[k[2]].end_time >= ct]
        mgr = sum(1 for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id and ms.end_time is not None and ms.end_time >= ct)
        needed = max(0, min_count - mgr)
        if ferm_vars and needed > 0:
            sf = model.new_int_var(0, needed, f"ferm_short_{day}")
            model.add(sum(ferm_vars) + sf >= needed)
            penalties.append(sf * PENALTY_FERMETURE)

    # Shift variety
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
                    penalties.append(both * PENALTY_VARIETY)

    # Prefer hours close to contract (maximise heures même si réduction)
    for emp in non_managers:
        terms = [(x[k], int(shift_map[k[2]].effective_hours * 10)) for k in x if k[0] == emp.id and shift_map.get(k[2])]
        if terms:
            total = sum(v * h for v, h in terms)
            target = int(emp.weekly_hours * 10)
            diff = model.new_int_var(0, 500, f"hdiff_{emp.id}")
            model.add(total - target <= diff)
            model.add(target - total <= diff)
            penalties.append(diff * PENALTY_HOUR_DIFF)

    # Productivity balance
    day_forecasts = {f.day_of_week: f.forecasted_revenue for f in req.day_forecasts}
    for ov in req.event_overrides:
        if ov.day_of_week in day_forecasts:
            day_forecasts[ov.day_of_week] *= (1 + ov.revenue_multiplier_percent / 100)
    for day in working_days:
        ca = day_forecasts.get(day, 0)
        if ca <= 0 or req.productivity_target <= 0: continue
        target_hours_10 = int(ca / req.productivity_target * 10)
        day_terms = [(x[k], int(shift_map[k[2]].effective_hours * 10)) for k in x if k[1] == day and k[0] in salle_ids and shift_map.get(k[2])]
        mgr_h10 = sum(int(((ms.end_time or 0) - (ms.start_time or 0)) * 10) for ms in req.manager_schedules if ms.day_of_week == day and ms.shift_template_id)
        if day_terms:
            day_total = sum(v * h for v, h in day_terms) + mgr_h10
            over = model.new_int_var(0, 5000, f"prod_over_{day}")
            under = model.new_int_var(0, 5000, f"prod_under_{day}")
            model.add(day_total - target_hours_10 <= over)
            model.add(target_hours_10 - day_total <= under)
            w = max(1, int(ca / 1000))
            penalties.append(over * w)
            penalties.append(under * w * 2)

    if penalties:
        model.minimize(sum(penalties))

    # Solve (multi-tentatives)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIMEOUT_SECONDS
    solver.parameters.num_workers = SOLVER_NUM_WORKERS
    best_status = None
    best_shortfalls = float('inf')
    best_objective = float('inf')
    best_solver = solver
    for attempt in range(SOLVER_MAX_ATTEMPTS):
        if attempt > 0:
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = SOLVER_TIMEOUT_SECONDS
            solver.parameters.num_workers = SOLVER_NUM_WORKERS
            solver.parameters.random_seed = attempt * SOLVER_SEED_MULTIPLIER
        status = solver.solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            if best_status is None: best_status = status
            continue
        total_sf = sum(solver.value(v) for v in user_visible_shortfalls)
        obj = solver.objective_value
        if best_status is None or total_sf < best_shortfalls or (total_sf == best_shortfalls and obj < best_objective):
            best_shortfalls = total_sf
            best_objective = obj
            best_solver = solver
            best_status = status
        if total_sf == 0: break
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
        if not s: continue
        start = ms.start_time if ms.start_time is not None else s.start_time
        end = ms.end_time if ms.end_time is not None else s.end_time
        entries.append(ShiftAssignment(employee_id=ms.employee_id, day_of_week=ms.day_of_week, shift_template_id=ms.shift_template_id, start_time=start, end_time=end, effective_hours=end - start, meals=s.meals, baskets=s.baskets))

    for k, var in x.items():
        if solver.value(var) == 1:
            emp_id, day, shift_id = k
            s = shift_map.get(shift_id)
            if not s: continue
            entries.append(ShiftAssignment(employee_id=emp_id, day_of_week=day, shift_template_id=shift_id, start_time=s.start_time, end_time=s.end_time, effective_hours=s.effective_hours, meals=s.meals, baskets=s.baskets))

    warnings = []
    status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
    if status == cp_model.FEASIBLE:
        warnings.append("Solution faisable mais pas optimale (timeout 10s)")
    return SolverResponse(success=True, entries=entries, status=status_str, solve_time_ms=solve_time, warnings=warnings)


def _add_days(iso_date: str, days: int) -> str:
    from datetime import datetime, timedelta
    try:
        d = datetime.fromisoformat(iso_date) + timedelta(days=days)
        return d.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return ""
