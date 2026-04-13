// ── Service & Role ──────────────────────────────────────────────

export type ServiceType = 'midi' | 'soir';
export type EmployeeRole = 'salle' | 'cuisine';
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayIndex, string> = {
  0: 'Lun',
  1: 'Mar',
  2: 'Mer',
  3: 'Jeu',
  4: 'Ven',
  5: 'Sam',
  6: 'Dim',
};

export const ALL_DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

// ── Shift ───────────────────────────────────────────────────────

export interface ShiftDefinition {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  role: EmployeeRole;
  service: ServiceType;
  durationHours: number;
  /** If set, replaces end time on Sunday */
  sundayOverride?: {
    endHour: number;
    endMinute: number;
    durationHours: number;
  };
}

// ── Employee ────────────────────────────────────────────────────

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  /** Weekly base contract hours – the planner must never go below this */
  contractHours: number;
  /** Per-day availability: which services can this employee work? */
  availability: Partial<Record<DayIndex, ServiceType[]>>;
}

// ── Assignment ──────────────────────────────────────────────────

export interface ShiftAssignment {
  employeeId: string;
  shiftDefinitionId: string;
  day: DayIndex;
}

// ── Day Configuration (per-day overrides) ───────────────────────

export interface DayConfig {
  day: DayIndex;
  /** null = use week-level default */
  minStaffMidi: number | null;
  minStaffSoir: number | null;
  /** Revenue adjustment vs. base, in percent (e.g. +20 = busy day) */
  revenueAdjustmentPct: number;
}

// ── Week Configuration ──────────────────────────────────────────

export interface WeekConfig {
  weekStart: string; // ISO date (Monday)
  baseWeeklyRevenue: number;
  dayConfigs: DayConfig[];
  defaultMinStaffMidi: number;
  defaultMinStaffSoir: number;
}

// ── Planning Result ─────────────────────────────────────────────

export interface PlanningResult {
  assignments: ShiftAssignment[];
  employeeSummaries: EmployeeWeekSummary[];
  productivity: ProductivityMetrics;
  warnings: string[];
}

export interface EmployeeWeekSummary {
  employeeId: string;
  employeeName: string;
  role: EmployeeRole;
  scheduledHours: number;
  contractHours: number;
  /** scheduledHours − contractHours (positive = overtime) */
  delta: number;
  belowContract: boolean;
}

export interface ProductivityMetrics {
  totalScheduledHours: number;
  weeklyRevenueTarget: number;
  /** CA cible / heures planifiées */
  revenuePerHour: number;
  recruitmentNeeded: boolean;
  recommendedExtraHours: number;
  productivityRating: 'low' | 'ok' | 'high';
}
