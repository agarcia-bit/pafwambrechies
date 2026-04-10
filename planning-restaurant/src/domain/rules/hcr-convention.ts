import type { PlanningEntry } from '../models/planning'

/**
 * Règles de la Convention Collective HCR
 * (Hôtels, Cafés, Restaurants)
 *
 * Chaque règle retourne null si OK, ou un message d'erreur si violation.
 */

/** Repos minimum entre deux shifts : 11 heures */
export const MIN_REST_BETWEEN_SHIFTS = 11

/** Durée max de travail par jour */
export const MAX_DAILY_HOURS = 10 // 11.5 sous conditions HCR

/** Durée max de travail par semaine (absolue) */
export const MAX_WEEKLY_HOURS_ABSOLUTE = 48

/** Durée max moyenne sur 12 semaines */
export const MAX_WEEKLY_HOURS_AVERAGE_12W = 44

/** Nombre minimum de jours de repos par semaine (incluant lundi fermé) */
export const MIN_DAYS_OFF_PER_WEEK = 2

/** Maximum de jours consécutifs travaillés */
export const MAX_CONSECUTIVE_WORK_DAYS = 6

/**
 * Vérifie le repos inter-shift (11h minimum).
 * Compare la fin du shift jour J avec le début du shift jour J+1.
 */
export function checkRestBetweenShifts(
  endTimePreviousDay: number,
  startTimeNextDay: number,
): string | null {
  // endTime peut être 24.0 (minuit), startTime le lendemain
  // Le repos = (24 - endTimePreviousDay) + startTimeNextDay
  // Sauf si endTime < startTime du même cycle (pas le cas ici)
  const restHours = 24 - endTimePreviousDay + startTimeNextDay
  if (restHours < MIN_REST_BETWEEN_SHIFTS) {
    return `Repos inter-shift insuffisant : ${restHours}h (minimum ${MIN_REST_BETWEEN_SHIFTS}h)`
  }
  return null
}

/**
 * Vérifie qu'un employé a au moins 2 jours off dans la semaine.
 */
export function checkMinDaysOff(
  workedDays: number[], // dayOfWeek des jours travaillés
): string | null {
  const daysOff = 7 - workedDays.length
  if (daysOff < MIN_DAYS_OFF_PER_WEEK) {
    return `Seulement ${daysOff} jour(s) de repos (minimum ${MIN_DAYS_OFF_PER_WEEK})`
  }
  return null
}

/**
 * Vérifie que le total hebdo est dans les bornes du contrat (avec modulation).
 */
export function checkWeeklyBounds(
  plannedHours: number,
  boundsMin: number,
  boundsMax: number,
): string | null {
  if (plannedHours < boundsMin) {
    return `Heures planifiées (${plannedHours}h) sous la borne min (${boundsMin}h)`
  }
  if (plannedHours > boundsMax) {
    return `Heures planifiées (${plannedHours}h) au-dessus de la borne max (${boundsMax}h)`
  }
  return null
}

/**
 * Vérifie le max absolu de 48h/semaine.
 */
export function checkAbsoluteMaxWeekly(
  plannedHours: number,
): string | null {
  if (plannedHours > MAX_WEEKLY_HOURS_ABSOLUTE) {
    return `Dépassement du maximum absolu : ${plannedHours}h (max ${MAX_WEEKLY_HOURS_ABSOLUTE}h)`
  }
  return null
}

/**
 * Vérifie le max journalier.
 */
export function checkDailyMax(
  dailyHours: number,
): string | null {
  if (dailyHours > MAX_DAILY_HOURS) {
    return `Dépassement du maximum journalier : ${dailyHours}h (max ${MAX_DAILY_HOURS}h)`
  }
  return null
}

/**
 * Vérifie les jours consécutifs travaillés (max 6).
 * Prend un tableau de booléens [lun, mar, ..., dim].
 */
export function checkConsecutiveWorkDays(
  workedDayFlags: boolean[],
): string | null {
  let consecutive = 0
  // On boucle 2 fois pour détecter les enchaînements semaine à semaine
  // Mais ici on se limite à la semaine courante (7 jours)
  for (const worked of workedDayFlags) {
    if (worked) {
      consecutive++
      if (consecutive > MAX_CONSECUTIVE_WORK_DAYS) {
        return `${consecutive} jours consécutifs travaillés (max ${MAX_CONSECUTIVE_WORK_DAYS})`
      }
    } else {
      consecutive = 0
    }
  }
  return null
}

/**
 * Vérifie la couverture continue (≥2 personnes de 11h à fermeture).
 */
export function checkContinuousCoverage(
  entries: PlanningEntry[],
  startHour: number,
  endHour: number,
): { hour: number; count: number }[] {
  const violations: { hour: number; count: number }[] = []

  for (let h = startHour; h < endHour; h += 0.5) {
    const count = entries.filter(
      (e) => e.startTime <= h && e.endTime > h,
    ).length
    if (count < 2) {
      violations.push({ hour: h, count })
    }
  }

  return violations
}

/**
 * Vérifie la couverture fermeture (≥3 personnes dont 1 manager).
 */
export function checkClosingCoverage(
  entries: PlanningEntry[],
  closingTime: number,
  managerEmployeeIds: string[],
  isSunday?: boolean,
): string | null {
  const minClosing = isSunday ? 4 : 3
  const closingStaff = entries.filter((e) => e.endTime >= closingTime)
  if (closingStaff.length < minClosing) {
    return `Seulement ${closingStaff.length} personne(s) à la fermeture (minimum ${minClosing})`
  }
  const hasManager = closingStaff.some((e) =>
    managerEmployeeIds.includes(e.employeeId),
  )
  if (!hasManager) {
    return 'Aucun manager présent à la fermeture'
  }
  return null
}
