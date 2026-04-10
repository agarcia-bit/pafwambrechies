import type { Employee } from '../models/employee'
import { getWeeklyBounds } from '../models/employee'
import type { PlanningEntry, RuleViolation } from '../models/planning'
import type { ShiftTemplate } from '../models/shift'
import {
  checkRestBetweenShifts,
  checkMinDaysOff,
  checkWeeklyBounds,
  checkAbsoluteMaxWeekly,
  checkConsecutiveWorkDays,
  checkContinuousCoverage,
  checkClosingCoverage,
} from './hcr-convention'

interface ValidationContext {
  entries: PlanningEntry[]
  employees: Employee[]
  managerIds: string[]
  shiftTemplates: ShiftTemplate[]
  closingTimeWeek: number
  closingTimeSunday: number
}

/**
 * Valide un planning complet et retourne toutes les violations.
 */
export function validatePlanning(ctx: ValidationContext): RuleViolation[] {
  const violations: RuleViolation[] = []

  for (const emp of ctx.employees) {
    const empEntries = ctx.entries.filter((e) => e.employeeId === emp.id)

    // Jours travaillés
    const workedDays = [...new Set(empEntries.map((e) => e.dayOfWeek))]

    // 1. Jours off minimum
    const offCheck = checkMinDaysOff(workedDays)
    if (offCheck) {
      violations.push({
        rule: 'min_days_off',
        severity: 'blocking',
        employeeId: emp.id,
        dayOfWeek: null,
        message: `${emp.firstName} ${emp.lastName}: ${offCheck}`,
      })
    }

    // 2. Bornes contractuelles
    const totalHours = empEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
    const bounds = getWeeklyBounds(emp)

    if (!emp.isManager) {
      const boundsCheck = checkWeeklyBounds(totalHours, bounds.min, bounds.max)
      if (boundsCheck) {
        violations.push({
          rule: 'weekly_bounds',
          severity: 'blocking',
          employeeId: emp.id,
          dayOfWeek: null,
          message: `${emp.firstName} ${emp.lastName}: ${boundsCheck}`,
        })
      }
    }

    // 3. Max absolu 48h
    const absCheck = checkAbsoluteMaxWeekly(totalHours)
    if (absCheck) {
      violations.push({
        rule: 'max_weekly_absolute',
        severity: 'blocking',
        employeeId: emp.id,
        dayOfWeek: null,
        message: `${emp.firstName} ${emp.lastName}: ${absCheck}`,
      })
    }

    // 4. Jours consécutifs
    const flags = [0, 1, 2, 3, 4, 5, 6].map((d) => workedDays.includes(d))
    const consCheck = checkConsecutiveWorkDays(flags)
    if (consCheck) {
      violations.push({
        rule: 'max_consecutive_days',
        severity: 'blocking',
        employeeId: emp.id,
        dayOfWeek: null,
        message: `${emp.firstName} ${emp.lastName}: ${consCheck}`,
      })
    }

    // 5. Repos inter-shift
    const sortedEntries = [...empEntries].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const current = sortedEntries[i]
      const next = sortedEntries[i + 1]
      // Seulement si jours consécutifs
      if (next.dayOfWeek === current.dayOfWeek + 1) {
        const restCheck = checkRestBetweenShifts(current.endTime, next.startTime)
        if (restCheck) {
          violations.push({
            rule: 'rest_between_shifts',
            severity: 'blocking',
            employeeId: emp.id,
            dayOfWeek: next.dayOfWeek,
            message: `${emp.firstName} ${emp.lastName}: ${restCheck}`,
          })
        }
      }
    }
  }

  // 6. Couverture continue par jour
  for (let day = 1; day <= 6; day++) {
    const dayEntries = ctx.entries.filter((e) => e.dayOfWeek === day)
    if (dayEntries.length === 0) continue

    const isSunday = day === 6
    const startHour = day >= 5 ? 10 : 11 // Sam-Dim: 10h, Mar-Ven: 11h
    const endHour = isSunday ? ctx.closingTimeSunday : ctx.closingTimeWeek

    const gaps = checkContinuousCoverage(dayEntries, startHour, endHour)
    for (const gap of gaps) {
      violations.push({
        rule: 'continuous_coverage',
        severity: 'blocking',
        employeeId: null,
        dayOfWeek: day,
        message: `Couverture insuffisante à ${gap.hour}h : ${gap.count} personne(s) (minimum 2)`,
      })
    }

    // 7. Couverture fermeture
    const closingTime = isSunday ? ctx.closingTimeSunday : ctx.closingTimeWeek
    const closingCheck = checkClosingCoverage(dayEntries, closingTime, ctx.managerIds, day)
    if (closingCheck) {
      violations.push({
        rule: 'closing_coverage',
        severity: 'blocking',
        employeeId: null,
        dayOfWeek: day,
        message: closingCheck,
      })
    }
  }

  return violations
}
