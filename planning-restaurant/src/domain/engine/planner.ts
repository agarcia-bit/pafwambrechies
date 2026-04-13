/**
 * V2 Employee-First Planning Algorithm
 *
 * Strategy: iterate over employees (not shifts) to build the weekly schedule.
 *
 * Hard rule: **never go below base contract hours** (exceeding is OK).
 *
 * Phase 1 – Fill minimum staffing for each day × service.
 * Phase 2 – Top-up employees still below their contract hours.
 * Phase 3 – Compute productivity metrics & warnings.
 */

import type {
  Employee,
  ShiftAssignment,
  WeekConfig,
  DayIndex,
  PlanningResult,
  EmployeeWeekSummary,
  ProductivityMetrics,
  EmployeeRole,
  ServiceType,
  ShiftDefinition,
} from '../types';
import { getShiftsForRole, getShiftHours } from '../shifts';
import { ALL_DAYS } from '../types';

// ── Public API ──────────────────────────────────────────────────

export function generatePlanning(
  employees: Employee[],
  weekConfig: WeekConfig,
): PlanningResult {
  const ctx = new PlannerContext(employees, weekConfig);

  // Run both roles through the same pipeline
  for (const role of ['salle', 'cuisine'] as EmployeeRole[]) {
    const pool = employees.filter((e) => e.role === role);
    if (pool.length === 0) continue;

    // Phase 1: satisfy minimum staffing per day/service
    for (const day of ALL_DAYS) {
      for (const service of ['midi', 'soir'] as ServiceType[]) {
        const minStaff = ctx.getMinStaff(day, service);
        ctx.fillService(pool, day, service, minStaff);
      }
    }

    // Phase 2: ensure every employee reaches contract hours
    ctx.topUpBelowContract(pool);
  }

  return ctx.buildResult();
}

// ── Planner internals ───────────────────────────────────────────

class PlannerContext {
  private assignments: ShiftAssignment[] = [];
  private hoursMap: Map<string, number> = new Map();
  private warnings: string[] = [];

  constructor(
    private employees: Employee[],
    private weekConfig: WeekConfig,
  ) {
    for (const e of employees) this.hoursMap.set(e.id, 0);
  }

  // ── Helpers ────────────────────

  private getHours(empId: string): number {
    return this.hoursMap.get(empId) ?? 0;
  }

  private addHours(empId: string, h: number) {
    this.hoursMap.set(empId, this.getHours(empId) + h);
  }

  private deficit(emp: Employee): number {
    return emp.contractHours - this.getHours(emp.id);
  }

  private isAssigned(empId: string, day: DayIndex, service?: ServiceType): boolean {
    return this.assignments.some((a) => {
      if (a.employeeId !== empId || a.day !== day) return false;
      if (!service) return true;
      const shift = this.findShiftDef(a.shiftDefinitionId);
      return shift ? shift.service === service : false;
    });
  }

  private findShiftDef(id: string): ShiftDefinition | undefined {
    return getShiftsForRole('salle').find((s) => s.id === id)
      ?? getShiftsForRole('cuisine').find((s) => s.id === id);
  }

  private isAvailable(emp: Employee, day: DayIndex, service: ServiceType): boolean {
    const dayAvail = emp.availability[day];
    return dayAvail != null && dayAvail.includes(service);
  }

  /**
   * Pick the best shift for an employee on a given day/service.
   * Prefers a shift whose duration gets them closest to their contract
   * without massive overshoot.
   */
  private pickShift(emp: Employee, day: DayIndex, service: ServiceType): ShiftDefinition | null {
    const candidates = getShiftsForRole(emp.role, service);
    if (candidates.length === 0) return null;

    const remaining = this.deficit(emp);

    // Sort candidates by how close they bring employee to target
    const scored = candidates.map((s) => {
      const h = getShiftHours(s, day);
      const overshoot = Math.max(0, h - remaining);
      const undershoot = Math.max(0, remaining - h);
      return { shift: s, score: undershoot + overshoot * 0.5 };
    });
    scored.sort((a, b) => a.score - b.score);

    return scored[0].shift;
  }

  // ── Core logic ─────────────────

  getMinStaff(day: DayIndex, service: ServiceType): number {
    const dc = this.weekConfig.dayConfigs.find((c) => c.day === day);
    if (service === 'midi') {
      return dc?.minStaffMidi ?? this.weekConfig.defaultMinStaffMidi;
    }
    return dc?.minStaffSoir ?? this.weekConfig.defaultMinStaffSoir;
  }

  /** Phase 1: assign up to `minStaff` employees for a day/service */
  fillService(
    pool: Employee[],
    day: DayIndex,
    service: ServiceType,
    minStaff: number,
  ) {
    // Sort employees: those with the largest deficit first
    const eligible = pool
      .filter(
        (e) =>
          this.isAvailable(e, day, service) &&
          !this.isAssigned(e.id, day, service),
      )
      .sort((a, b) => this.deficit(b) - this.deficit(a));

    let assigned = 0;
    for (const emp of eligible) {
      if (assigned >= minStaff) break;

      const shift = this.pickShift(emp, day, service);
      if (!shift) continue;

      this.assignments.push({
        employeeId: emp.id,
        shiftDefinitionId: shift.id,
        day,
      });
      this.addHours(emp.id, getShiftHours(shift, day));
      assigned++;
    }

    if (assigned < minStaff) {
      const dayLabel = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][day];
      this.warnings.push(
        `${dayLabel} ${service}: seulement ${assigned}/${minStaff} employés assignés`,
      );
    }
  }

  /** Phase 2: add shifts so every employee reaches their contract hours */
  topUpBelowContract(pool: Employee[]) {
    // Iterate until stable (max 20 passes for safety)
    for (let pass = 0; pass < 20; pass++) {
      const belowContract = pool
        .filter((e) => this.deficit(e) > 0)
        .sort((a, b) => this.deficit(b) - this.deficit(a));

      if (belowContract.length === 0) break;

      let changed = false;
      for (const emp of belowContract) {
        if (this.deficit(emp) <= 0) continue;

        // Find the best day/service to add a shift
        const slot = this.findBestSlot(emp);
        if (!slot) {
          if (pass === 0) {
            this.warnings.push(
              `${emp.firstName} ${emp.lastName}: impossible d'atteindre ${emp.contractHours}h (${this.getHours(emp.id).toFixed(1)}h planifiées)`,
            );
          }
          continue;
        }

        this.assignments.push(slot.assignment);
        this.addHours(emp.id, slot.hours);
        changed = true;
      }

      if (!changed) break;
    }
  }

  /** Find the best unoccupied slot to add for an employee */
  private findBestSlot(
    emp: Employee,
  ): { assignment: ShiftAssignment; hours: number } | null {
    let best: { assignment: ShiftAssignment; hours: number; score: number } | null = null;

    for (const day of ALL_DAYS) {
      for (const service of ['midi', 'soir'] as ServiceType[]) {
        if (!this.isAvailable(emp, day, service)) continue;
        if (this.isAssigned(emp.id, day, service)) continue;

        const shift = this.pickShift(emp, day, service);
        if (!shift) continue;

        const h = getShiftHours(shift, day);
        const remaining = this.deficit(emp);
        // Prefer shifts that get us closest to exactly filling the gap
        const overshoot = Math.max(0, h - remaining);
        const score = overshoot;

        if (!best || score < best.score) {
          best = {
            assignment: { employeeId: emp.id, shiftDefinitionId: shift.id, day },
            hours: h,
            score,
          };
        }
      }
    }

    return best;
  }

  // ── Result building ────────────

  buildResult(): PlanningResult {
    const employeeSummaries: EmployeeWeekSummary[] = this.employees.map((e) => {
      const scheduled = this.getHours(e.id);
      return {
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        role: e.role,
        scheduledHours: scheduled,
        contractHours: e.contractHours,
        delta: scheduled - e.contractHours,
        belowContract: scheduled < e.contractHours,
      };
    });

    const totalScheduledHours = [...this.hoursMap.values()].reduce((a, b) => a + b, 0);
    const weeklyRevenueTarget = this.computeWeeklyRevenue();
    const revenuePerHour = totalScheduledHours > 0 ? weeklyRevenueTarget / totalScheduledHours : 0;

    // Productivity thresholds (€/h)
    const TARGET_RPH = 40; // typical target
    const recruitmentNeeded = revenuePerHour > TARGET_RPH * 1.3;
    const recommendedExtraHours = recruitmentNeeded
      ? Math.round(weeklyRevenueTarget / TARGET_RPH - totalScheduledHours)
      : 0;

    const productivityRating: ProductivityMetrics['productivityRating'] =
      revenuePerHour > TARGET_RPH * 1.3
        ? 'high'  // too few hours → need to recruit
        : revenuePerHour < TARGET_RPH * 0.7
          ? 'low'  // too many hours → overstaffed
          : 'ok';

    const productivity: ProductivityMetrics = {
      totalScheduledHours,
      weeklyRevenueTarget,
      revenuePerHour,
      recruitmentNeeded,
      recommendedExtraHours,
      productivityRating,
    };

    return {
      assignments: this.assignments,
      employeeSummaries,
      productivity,
      warnings: this.warnings,
    };
  }

  private computeWeeklyRevenue(): number {
    const baseDailyRevenue = this.weekConfig.baseWeeklyRevenue / 7;
    let total = 0;
    for (const dc of this.weekConfig.dayConfigs) {
      total += baseDailyRevenue * (1 + dc.revenueAdjustmentPct / 100);
    }
    return total;
  }
}

// ── Utility: recalculate planning after manual shift edit ────────

export function recalculateAfterEdit(
  employees: Employee[],
  assignments: ShiftAssignment[],
  weekConfig: WeekConfig,
): Omit<PlanningResult, 'assignments'> {
  const hoursMap = new Map<string, number>();
  for (const e of employees) hoursMap.set(e.id, 0);

  for (const a of assignments) {
    const shift = getShiftsForRole('salle').find((s) => s.id === a.shiftDefinitionId)
      ?? getShiftsForRole('cuisine').find((s) => s.id === a.shiftDefinitionId);
    if (shift) {
      const h = getShiftHours(shift, a.day);
      hoursMap.set(a.employeeId, (hoursMap.get(a.employeeId) ?? 0) + h);
    }
  }

  const employeeSummaries: EmployeeWeekSummary[] = employees.map((e) => {
    const scheduled = hoursMap.get(e.id) ?? 0;
    return {
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`,
      role: e.role,
      scheduledHours: scheduled,
      contractHours: e.contractHours,
      delta: scheduled - e.contractHours,
      belowContract: scheduled < e.contractHours,
    };
  });

  const totalScheduledHours = [...hoursMap.values()].reduce((a, b) => a + b, 0);
  const baseDailyRevenue = weekConfig.baseWeeklyRevenue / 7;
  let weeklyRevenueTarget = 0;
  for (const dc of weekConfig.dayConfigs) {
    weeklyRevenueTarget += baseDailyRevenue * (1 + dc.revenueAdjustmentPct / 100);
  }

  const revenuePerHour = totalScheduledHours > 0 ? weeklyRevenueTarget / totalScheduledHours : 0;
  const TARGET_RPH = 40;
  const recruitmentNeeded = revenuePerHour > TARGET_RPH * 1.3;

  const productivity: ProductivityMetrics = {
    totalScheduledHours,
    weeklyRevenueTarget,
    revenuePerHour,
    recruitmentNeeded,
    recommendedExtraHours: recruitmentNeeded
      ? Math.round(weeklyRevenueTarget / TARGET_RPH - totalScheduledHours)
      : 0,
    productivityRating:
      revenuePerHour > TARGET_RPH * 1.3
        ? 'high'
        : revenuePerHour < TARGET_RPH * 0.7
          ? 'low'
          : 'ok',
  };

  const warnings: string[] = [];
  for (const s of employeeSummaries) {
    if (s.belowContract) {
      warnings.push(`${s.employeeName}: sous contrat (${s.scheduledHours.toFixed(1)}h / ${s.contractHours}h)`);
    }
  }

  return { employeeSummaries, productivity, warnings };
}
