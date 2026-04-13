"""
Kitchen planning solver using Google OR-Tools CP-SAT.

Kitchen specifics:
- Employees can work MIDI + SOIR on the same day (split shift with break)
- No opening/closing/coverage constraints
- Just fill contract hours with available shifts
- Sunday evening: closed
- Special constraints per employee (e.g. Chaker ends 15h on Sunday)
"""
import time
from typing import List, Dict, Optional
from ortools.sat.python import cp_model
from models import SolverRequest, SolverResponse, ShiftAssignment


def solve_kitchen(req: SolverRequest) -> SolverResponse:
    start_time = time.time()
    model = cp_model.CpModel()

    working_days = [1, 2, 3, 4, 5, 6]  # Tue-Sun
    kitchen_employees = [e for e in req.employees if e.department == "cuisine"]

    if not kitchen_employees:
        return SolverResponse(success=True, entries=[], status="NO_KITCHEN", solve_time_ms=0,
                              warnings=["Aucun salarié cuisine"])

    # Kitchen shifts only
    kitchen_shifts = [s for s in req.shift_templates if s.department == "cuisine"]
    shift_map = {s.id: s for s in kitchen_shifts}

    def shifts_for_day(day: int) -> list:
        result = []
        for s in kitchen_shifts:
            if day == 6 and s.applicability == "sunday":
                result.append(s)
            elif day < 6 and s.applicability in ("tue_sat", "sat_only"):
                result.append(s)
        return result

    # Midi shifts (start < 16h)
    def midi_shifts_for_day(day: int) -> list:
        return [s for s in shifts_for_day(day) if s.end_time <= 16]

    # Soir shifts (start >= 17h)
    def soir_shifts_for_day(day: int) -> list:
        return [s for s in shifts_for_day(day) if s.start_time >= 17]

    # Build unavailability sets
    fixed_unavail: Dict[str, set] = {}
    for u in req.unavailabilities:
        if u.type == "fixed" and u.day_of_week is not None:
            fixed_unavail.setdefault(u.employee_id, set()).add(u.day_of_week)

    # --- Variables ---
    # For kitchen: each employee can have a MIDI shift AND a SOIR shift on the same day
    # x_midi[emp_id, day, shift_id] and x_soir[emp_id, day, shift_id]
    x_midi: Dict[tuple, cp_model.IntVar] = {}
    x_soir: Dict[tuple, cp_model.IntVar] = {}

    for emp in kitchen_employees:
        for day in working_days:
            if day in fixed_unavail.get(emp.id, set()):
                continue

            # Midi shifts
            for shift in midi_shifts_for_day(day):
                x_midi[(emp.id, day, shift.id)] = model.new_bool_var(
                    f"km_{emp.id}_{day}_{shift.id}")

            # Soir shifts (not Sunday — kitchen closed Sunday evening)
            if day != 6:
                for shift in soir_shifts_for_day(day):
                    x_soir[(emp.id, day, shift.id)] = model.new_bool_var(
                        f"ks_{emp.id}_{day}_{shift.id}")

    # --- Constraints ---

    # 1. At most 1 midi shift per employee per day
    for emp in kitchen_employees:
        for day in working_days:
            midi_vars = [x_midi[k] for k in x_midi if k[0] == emp.id and k[1] == day]
            if midi_vars:
                model.add(sum(midi_vars) <= 1)

    # 2. At most 1 soir shift per employee per day
    for emp in kitchen_employees:
        for day in working_days:
            soir_vars = [x_soir[k] for k in x_soir if k[0] == emp.id and k[1] == day]
            if soir_vars:
                model.add(sum(soir_vars) <= 1)

    # 3. Working day = has at least 1 shift (midi or soir)
    works_day: Dict[tuple, cp_model.IntVar] = {}
    for emp in kitchen_employees:
        for day in working_days:
            midi_vars = [x_midi[k] for k in x_midi if k[0] == emp.id and k[1] == day]
            soir_vars = [x_soir[k] for k in x_soir if k[0] == emp.id and k[1] == day]
            all_vars = midi_vars + soir_vars
            if all_vars:
                wd = model.new_bool_var(f"kwd_{emp.id}_{day}")
                model.add(sum(all_vars) >= 1).only_enforce_if(wd)
                model.add(sum(all_vars) == 0).only_enforce_if(wd.negated())
                works_day[(emp.id, day)] = wd

    # 4. Max 5 working days, full-time = exactly 5
    for emp in kitchen_employees:
        emp_days = [works_day[k] for k in works_day if k[0] == emp.id]
        if emp_days:
            model.add(sum(emp_days) <= 5)
            if emp.weekly_hours >= 35:
                model.add(sum(emp_days) >= 5)

    # 5. Contract hours: total >= weekly_hours, total <= weekly_hours + modulation
    for emp in kitchen_employees:
        hour_terms = []
        for k in x_midi:
            if k[0] == emp.id:
                s = shift_map[k[2]]
                hour_terms.append((x_midi[k], int(s.effective_hours * 10)))
        for k in x_soir:
            if k[0] == emp.id:
                s = shift_map[k[2]]
                hour_terms.append((x_soir[k], int(s.effective_hours * 10)))

        if hour_terms:
            total = sum(v * h for v, h in hour_terms)
            min_h = int(emp.weekly_hours * 10)
            max_h = int((emp.weekly_hours + emp.modulation_range) * 10)
            model.add(total >= min_h)
            model.add(total <= max_h)

    # 6. Repos entre jours consécutifs — SOFT pour la cuisine
    # En cuisine, le repos 11h est intégré dans les horaires (coupure 15h-18h)
    # On pénalise légèrement soir(23h) + midi(9h) le lendemain mais on ne bloque pas
    for emp in kitchen_employees:
        for day in working_days:
            next_day = day + 1
            if next_day > 6:
                continue
            for k_soir in x_soir:
                if k_soir[0] != emp.id or k_soir[1] != day:
                    continue
                s_soir = shift_map[k_soir[2]]
                for k_midi in x_midi:
                    if k_midi[0] != emp.id or k_midi[1] != next_day:
                        continue
                    s_midi = shift_map[k_midi[2]]
                    rest = 24 - s_soir.end_time + s_midi.start_time
                    if rest < 11:
                        # Soft penalty instead of hard block
                        both = model.new_bool_var(f"krest_{emp.id}_{day}")
                        model.add(x_soir[k_soir] + x_midi[k_midi] - 1 <= both)
                        penalties.append(both * 3)

    # 7. Special: Chaker + Bauer + Ibra all work Tuesday MIDI (preparation)
    chaker = next((e for e in kitchen_employees if e.first_name.lower() == "chaker"), None)
    bauer = next((e for e in kitchen_employees if e.first_name.lower() == "bauer"), None)
    ibra = next((e for e in kitchen_employees if e.first_name.lower() == "ibra"), None)

    tuesday = 1  # day_of_week 1 = mardi
    for emp in [chaker, bauer, ibra]:
        if emp is None:
            continue
        tuesday_midi = [x_midi[k] for k in x_midi
                       if k[0] == emp.id and k[1] == tuesday]
        if tuesday_midi:
            model.add(sum(tuesday_midi) >= 1)

    # --- Objectives ---
    penalties = []

    # 8. Prefer hours close to contract
    for emp in kitchen_employees:
        hour_terms = []
        for k in x_midi:
            if k[0] == emp.id:
                hour_terms.append((x_midi[k], int(shift_map[k[2]].effective_hours * 10)))
        for k in x_soir:
            if k[0] == emp.id:
                hour_terms.append((x_soir[k], int(shift_map[k[2]].effective_hours * 10)))
        if hour_terms:
            total = sum(v * h for v, h in hour_terms)
            target = int(emp.weekly_hours * 10)
            diff = model.new_int_var(0, 500, f"khdiff_{emp.id}")
            model.add(total - target <= diff)
            model.add(target - total <= diff)
            penalties.append(diff * 2)

    # 9. Variety: avoid same pattern every day
    for emp in kitchen_employees:
        for day in working_days:
            next_day = day + 1
            if next_day > 6:
                continue
            for shift in kitchen_shifts:
                k1_m = (emp.id, day, shift.id)
                k2_m = (emp.id, next_day, shift.id)
                if k1_m in x_midi and k2_m in x_midi:
                    both = model.new_bool_var(f"ksame_m_{emp.id}_{day}_{shift.id}")
                    model.add(x_midi[k1_m] + x_midi[k2_m] - 1 <= both)
                    penalties.append(both * 3)

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
            success=False, status="INFEASIBLE", solve_time_ms=solve_time,
            warnings=["Cuisine: aucune solution trouvée"])

    # --- Extract ---
    entries: List[ShiftAssignment] = []
    for k, var in x_midi.items():
        if solver.value(var) == 1:
            s = shift_map[k[2]]
            entries.append(ShiftAssignment(
                employee_id=k[0], day_of_week=k[1], shift_template_id=k[2],
                start_time=s.start_time, end_time=s.end_time,
                effective_hours=s.effective_hours, meals=s.meals, baskets=s.baskets))

    for k, var in x_soir.items():
        if solver.value(var) == 1:
            s = shift_map[k[2]]
            entries.append(ShiftAssignment(
                employee_id=k[0], day_of_week=k[1], shift_template_id=k[2],
                start_time=s.start_time, end_time=s.end_time,
                effective_hours=s.effective_hours, meals=s.meals, baskets=s.baskets))

    status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
    warnings = []
    if status == cp_model.FEASIBLE:
        warnings.append("Cuisine: solution faisable mais pas optimale")

    return SolverResponse(
        success=True, entries=entries, status=status_str,
        solve_time_ms=solve_time, warnings=warnings)
