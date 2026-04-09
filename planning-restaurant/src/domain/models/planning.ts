import type { ShiftTemplate } from './shift'

/**
 * Un planning hebdomadaire complet.
 */
export interface WeekPlanning {
  id: string
  tenantId: string
  weekStartDate: string // ISO date du lundi
  weekNumber: number
  status: 'draft' | 'validated'
  generatedAt: string
  createdBy: string
  entries: PlanningEntry[]
}

/**
 * Une affectation : un employé, un jour, un créneau.
 */
export interface PlanningEntry {
  id: string
  planningId: string
  employeeId: string
  roleId: string
  date: string // ISO date
  dayOfWeek: number // 0=lundi..6=dimanche
  shiftTemplateId: string
  startTime: number // décimal
  endTime: number // décimal
  effectiveHours: number // heures effectives du créneau
  meals: number
  baskets: number
}

/**
 * CA prévisionnel par jour de la semaine (basé sur N-1).
 */
export interface DailyForecast {
  id: string
  tenantId: string
  month: number // 1-12
  dayOfWeek: number // 0=lundi..6=dimanche
  forecastedRevenue: number // CA en euros
}

/**
 * Résultat de la génération — rapport complet.
 */
export interface PlanningReport {
  planning: WeekPlanning
  employeeSummaries: EmployeeWeekSummary[]
  dailySummaries: DailySummary[]
  violations: RuleViolation[]
  warnings: string[]
  isValid: boolean
}

export interface EmployeeWeekSummary {
  employeeId: string
  employeeName: string
  contractHours: number
  plannedHours: number
  boundsMin: number
  boundsMax: number
  status: 'ok' | 'under' | 'over'
  daysOff: number[] // dayOfWeek des jours off
  totalMeals: number
  totalBaskets: number
}

export interface DailySummary {
  date: string
  dayOfWeek: number
  forecastedRevenue: number
  plannedHours: number
  productivity: number // CA / heures
  coverageMidi: number // nb personnes midi
  coverageApresMidi: number
  coverageSoir: number
  openingStaff: number
  closingStaff: number
  isDelestage: boolean
  delestageReason: string | null
}

export interface RuleViolation {
  rule: string
  severity: 'blocking' | 'warning'
  employeeId: string | null
  dayOfWeek: number | null
  message: string
}

/**
 * Besoin journalier : combien de personnes de chaque rôle par jour.
 */
export interface DailyRequirement {
  id: string
  tenantId: string
  dayOfWeek: number
  roleId: string
  requiredCount: number
  startTime: number
  endTime: number
}

/**
 * Helper : récupérer les infos du shift template pour un entry
 */
export function entryFromTemplate(
  template: ShiftTemplate,
  planningId: string,
  employeeId: string,
  roleId: string,
  date: string,
  dayOfWeek: number,
): Omit<PlanningEntry, 'id'> {
  return {
    planningId,
    employeeId,
    roleId,
    date,
    dayOfWeek,
    shiftTemplateId: template.id,
    startTime: template.startTime,
    endTime: template.endTime,
    effectiveHours: template.effectiveHours,
    meals: template.meals,
    baskets: template.baskets,
  }
}
