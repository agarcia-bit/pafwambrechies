import type { Employee } from '../models/employee'
import type { ShiftTemplate } from '../models/shift'
import type { Unavailability, ConditionalAvailability, ManagerFixedSchedule } from '../models/constraint'
import type { DailyForecast, DailyRequirement } from '../models/planning'
import type { Role, EmployeeRole } from '../models/role'
import type { Tenant } from '../models/tenant'

/**
 * Toutes les données nécessaires pour générer un planning.
 */
export interface PlannerInput {
  tenant: Tenant
  weekStartDate: string // ISO date du lundi
  employees: Employee[]
  roles: Role[]
  employeeRoles: EmployeeRole[]
  shiftTemplates: ShiftTemplate[]
  unavailabilities: Unavailability[]
  conditionalAvailabilities: ConditionalAvailability[]
  managerSchedules: ManagerFixedSchedule[]
  dailyForecasts: DailyForecast[]
  dailyRequirements: DailyRequirement[]
  eventOverrides?: EventOverride[] // bonus CA événementiel
}

export interface EventOverride {
  date: string
  revenueMultiplierPercent: number // ex: +20 = CA * 1.2
}

/**
 * État interne du solveur pendant la génération.
 */
export interface SolverState {
  /** Heures déjà planifiées par employé */
  employeeHours: Map<string, number>
  /** Jours travaillés par employé (set de dayOfWeek) */
  employeeWorkDays: Map<string, Set<number>>
  /** Dernière heure de fin par employé (pour repos inter-shift) */
  employeeLastEndTime: Map<string, { day: number; endTime: number }>
  /** Entrées de planning déjà validées */
  entries: import('../models/planning').PlanningEntry[]
  /** Heures planifiées par jour */
  dailyHours: Map<number, number>
  /** Warnings accumulés */
  warnings: string[]
}

/**
 * Jour de la semaine avec ses infos pour l'allocation.
 */
export interface DayAllocationContext {
  dayOfWeek: number // 0-6
  date: string
  isSunday: boolean
  forecastedRevenue: number
  hoursBudget: number
  managerHours: number
  allocatableHours: number
  closingTime: number
}
