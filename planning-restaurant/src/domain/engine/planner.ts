import type { PlanningEntry, PlanningReport, WeekPlanning, EmployeeWeekSummary, DailySummary } from '../models/planning'
import { getWeeklyBounds } from '../models/employee'
import type { Employee } from '../models/employee'
import type { ShiftTemplate } from '../models/shift'
import { calculateAllocatableHours, calculateHoursBudget, isDelestageRequired, DELESTAGE_ORDER, NEVER_UNDERSTAFF } from '../rules/productivity'
import { checkRestBetweenShifts } from '../rules/hcr-convention'
import { validatePlanning } from '../rules/validation'
import type { PlannerInput, SolverState, DayAllocationContext } from './types'

/**
 * Génère un planning hebdomadaire complet.
 *
 * Algorithme :
 * 1. Copier les horaires fixes des managers
 * 2. Calculer le budget heures par jour (CA/95 - heures managers)
 * 3. Allouer les salariés par ordre de priorité :
 *    - Jours : Sam → Dim → Ven soir → reste
 *    - Employés : contraints d'abord, flexibles ensuite
 *    - Créneaux : ouverture → midi → après-midi → soir → fermeture
 * 4. Valider toutes les règles
 */
export function generatePlanning(input: PlannerInput): PlanningReport {
  const planningId = crypto.randomUUID()
  const weekNumber = getWeekNumber(input.weekStartDate)

  const state: SolverState = {
    employeeHours: new Map(),
    employeeWorkDays: new Map(),
    employeeLastEndTime: new Map(),
    entries: [],
    dailyHours: new Map(),
    warnings: [],
  }

  // Init state pour chaque employé
  for (const emp of input.employees) {
    state.employeeHours.set(emp.id, 0)
    state.employeeWorkDays.set(emp.id, new Set())
  }

  // Phase 1 : Managers (copier horaires fixes)
  applyManagerSchedules(input, state, planningId)

  // Phase 2 : Calculer les contextes d'allocation par jour
  const dayContexts = buildDayContexts(input, state)

  // Phase 3 : Vérifier si délestage nécessaire
  const totalBudget = dayContexts.reduce((s, d) => s + d.hoursBudget, 0)
  const totalAvailable = calculateTotalAvailableHours(input)
  const needsDelestage = isDelestageRequired(totalBudget, totalAvailable)

  if (needsDelestage) {
    state.warnings.push(
      `Délestage activé : budget total ${totalBudget.toFixed(1)}h > disponible ${totalAvailable.toFixed(1)}h`,
    )
  }

  // Phase 4 : Allocation — ordre de priorité des jours
  const dayOrder = getAllocationDayOrder()
  for (const dayOfWeek of dayOrder) {
    const ctx = dayContexts.find((d) => d.dayOfWeek === dayOfWeek)
    if (!ctx) continue
    allocateDay(input, state, ctx, planningId, needsDelestage)
  }

  // Phase 5 : Construire le planning
  const planning: WeekPlanning = {
    id: planningId,
    tenantId: input.tenant.id,
    weekStartDate: input.weekStartDate,
    weekNumber,
    status: 'draft',
    generatedAt: new Date().toISOString(),
    createdBy: '',
    entries: state.entries,
  }

  // Phase 6 : Validation complète
  const violations = validatePlanning({
    entries: state.entries,
    employees: input.employees.filter((e) => e.active),
    managerIds: input.employees.filter((e) => e.isManager).map((e) => e.id),
    shiftTemplates: input.shiftTemplates,
    closingTimeWeek: input.tenant.closingTimeWeek,
    closingTimeSunday: input.tenant.closingTimeSunday,
  })

  // Phase 7 : Construire le rapport
  const employeeSummaries = buildEmployeeSummaries(input, state)
  const dailySummaries = buildDailySummaries(input, state, dayContexts)

  return {
    planning,
    employeeSummaries,
    dailySummaries,
    violations,
    warnings: state.warnings,
    isValid: violations.filter((v) => v.severity === 'blocking').length === 0,
  }
}

// --- Fonctions internes ---

function applyManagerSchedules(
  input: PlannerInput,
  state: SolverState,
  planningId: string,
): void {
  const managers = input.employees.filter((e) => e.isManager && e.active)

  for (const manager of managers) {
    const schedules = input.managerSchedules.filter(
      (s) => s.employeeId === manager.id,
    )
    for (const schedule of schedules) {
      if (!schedule.shiftTemplateId) continue // OFF ce jour

      const template = input.shiftTemplates.find(
        (t) => t.id === schedule.shiftTemplateId,
      )
      const startTime = schedule.startTime ?? template?.startTime ?? 0
      const endTime = schedule.endTime ?? template?.endTime ?? 0
      const effectiveHours = endTime - startTime

      const date = addDays(input.weekStartDate, schedule.dayOfWeek)

      // Trouver le premier rôle du manager
      const roleId = input.employeeRoles.find(
        (er) => er.employeeId === manager.id,
      )?.roleId ?? ''

      const entry: PlanningEntry = {
        id: crypto.randomUUID(),
        planningId,
        employeeId: manager.id,
        roleId,
        date,
        dayOfWeek: schedule.dayOfWeek,
        shiftTemplateId: schedule.shiftTemplateId,
        startTime,
        endTime,
        effectiveHours,
        meals: template?.meals ?? 0,
        baskets: template?.baskets ?? 0,
      }

      state.entries.push(entry)
      state.employeeHours.set(
        manager.id,
        (state.employeeHours.get(manager.id) ?? 0) + effectiveHours,
      )
      state.employeeWorkDays.get(manager.id)?.add(schedule.dayOfWeek)
      state.dailyHours.set(
        schedule.dayOfWeek,
        (state.dailyHours.get(schedule.dayOfWeek) ?? 0) + effectiveHours,
      )
      state.employeeLastEndTime.set(manager.id, {
        day: schedule.dayOfWeek,
        endTime,
      })
    }
  }
}

function buildDayContexts(
  input: PlannerInput,
  state: SolverState,
): DayAllocationContext[] {
  const contexts: DayAllocationContext[] = []

  for (let day = 1; day <= 6; day++) {
    // Jour 0 = lundi = fermé
    const date = addDays(input.weekStartDate, day)
    const isSunday = day === 6
    const month = new Date(date).getMonth() + 1

    // CA prévisionnel
    const forecast = input.dailyForecasts.find(
      (f) => f.month === month && f.dayOfWeek === day,
    )
    let forecastedRevenue = forecast?.forecastedRevenue ?? 0

    // Event override
    const override = input.eventOverrides?.find((e) => e.date === date)
    if (override) {
      forecastedRevenue *= 1 + override.revenueMultiplierPercent / 100
    }

    const hoursBudget = calculateHoursBudget(
      forecastedRevenue,
      input.tenant.productivityTarget,
    )
    const managerHours = state.dailyHours.get(day) ?? 0
    const allocatableHours = calculateAllocatableHours(
      forecastedRevenue,
      input.tenant.productivityTarget,
      managerHours,
    )
    const closingTime = isSunday
      ? input.tenant.closingTimeSunday
      : input.tenant.closingTimeWeek

    contexts.push({
      dayOfWeek: day,
      date,
      isSunday,
      forecastedRevenue,
      hoursBudget,
      managerHours,
      allocatableHours,
      closingTime,
    })
  }

  return contexts
}

/**
 * Ordre d'allocation des jours :
 * Samedi → Dimanche → Vendredi soir → Mardi → Mercredi → Jeudi → Vendredi
 */
function getAllocationDayOrder(): number[] {
  return [5, 6, 4, 1, 2, 3] // sam, dim, ven, mar, mer, jeu
}

function allocateDay(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  needsDelestage: boolean,
): void {
  const nonManagers = input.employees.filter(
    (e) => !e.isManager && e.active,
  )

  // Trier : contraints d'abord (moins de créneaux dispo), puis flexibles
  const sorted = [...nonManagers].sort((a, b) => {
    const aSlots = getAvailableShifts(input, state, a, ctx).length
    const bSlots = getAvailableShifts(input, state, b, ctx).length
    return aSlots - bSlots // moins de choix = plus contraint = en premier
  })

  let remainingHours = ctx.allocatableHours

  // Vérifier si ce jour est en délestage
  const isDelestageDay =
    needsDelestage &&
    DELESTAGE_ORDER.some((d) => d.dayOfWeek === ctx.dayOfWeek) &&
    !NEVER_UNDERSTAFF.includes(ctx.dayOfWeek)

  for (const emp of sorted) {
    if (remainingHours <= 0) break

    // Vérifier si l'employé peut travailler ce jour
    if (!canWorkDay(input, state, emp, ctx)) continue

    // Obtenir les créneaux disponibles
    const availableShifts = getAvailableShifts(input, state, emp, ctx)
    if (availableShifts.length === 0) continue

    // Choisir le meilleur créneau (celui qui se rapproche le plus du budget restant)
    const bestShift = chooseBestShift(availableShifts, remainingHours, emp, state)
    if (!bestShift) continue

    // Vérifier que l'ajout ne casse pas les bornes contractuelles
    const currentHours = state.employeeHours.get(emp.id) ?? 0
    const bounds = getWeeklyBounds(emp)
    if (currentHours + bestShift.effectiveHours > bounds.max) continue

    // Trouver le rôle à assigner
    const roleId = pickRole(input, emp)

    const entry: PlanningEntry = {
      id: crypto.randomUUID(),
      planningId,
      employeeId: emp.id,
      roleId,
      date: ctx.date,
      dayOfWeek: ctx.dayOfWeek,
      shiftTemplateId: bestShift.id,
      startTime: bestShift.startTime,
      endTime: bestShift.endTime,
      effectiveHours: bestShift.effectiveHours,
      meals: bestShift.meals,
      baskets: bestShift.baskets,
    }

    state.entries.push(entry)
    state.employeeHours.set(emp.id, currentHours + bestShift.effectiveHours)
    state.employeeWorkDays.get(emp.id)?.add(ctx.dayOfWeek)
    state.dailyHours.set(
      ctx.dayOfWeek,
      (state.dailyHours.get(ctx.dayOfWeek) ?? 0) + bestShift.effectiveHours,
    )
    state.employeeLastEndTime.set(emp.id, {
      day: ctx.dayOfWeek,
      endTime: bestShift.endTime,
    })

    remainingHours -= bestShift.effectiveHours
  }

  if (isDelestageDay && remainingHours > 0) {
    state.warnings.push(
      `Délestage jour ${ctx.dayOfWeek} : ${remainingHours.toFixed(1)}h non pourvues`,
    )
  }
}

function canWorkDay(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  ctx: DayAllocationContext,
): boolean {
  // Lundi = fermé
  if (ctx.dayOfWeek === 0) return false

  // Déjà assigné ce jour ?
  if (state.employeeWorkDays.get(emp.id)?.has(ctx.dayOfWeek)) return false

  // Indisponibilité fixe ?
  const fixedUnavail = input.unavailabilities.find(
    (u) =>
      u.employeeId === emp.id &&
      u.type === 'fixed' &&
      u.dayOfWeek === ctx.dayOfWeek,
  )
  if (fixedUnavail) return false

  // Indisponibilité ponctuelle ?
  const punctualUnavail = input.unavailabilities.find(
    (u) =>
      u.employeeId === emp.id &&
      u.type === 'punctual' &&
      u.specificDate === ctx.date,
  )
  if (punctualUnavail) return false

  // Vérifier repos inter-shift (11h)
  const lastEnd = state.employeeLastEndTime.get(emp.id)
  if (lastEnd && lastEnd.day === ctx.dayOfWeek - 1) {
    const violation = checkRestBetweenShifts(lastEnd.endTime, 9.5) // plus tôt possible
    if (violation) return false
  }

  // Vérifier max jours travaillés (besoin d'au moins 2 jours off)
  const workDays = state.employeeWorkDays.get(emp.id)
  if (workDays && workDays.size >= 5) return false // 5 jours + lundi off = 6 jours, OK pour 2 off

  return true
}

function getAvailableShifts(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  ctx: DayAllocationContext,
): ShiftTemplate[] {
  const isSunday = ctx.dayOfWeek === 6
  const isSaturday = ctx.dayOfWeek === 5

  // Filtrer par applicabilité jour
  let shifts = input.shiftTemplates.filter((s) => {
    if (isSunday) return s.applicability === 'sunday'
    if (isSaturday)
      return s.applicability === 'tue_sat' || s.applicability === 'sat_only'
    return s.applicability === 'tue_sat'
  })

  // Filtrer par disponibilité conditionnelle
  const conditional = input.conditionalAvailabilities.find(
    (ca) => ca.employeeId === emp.id && ca.dayOfWeek === ctx.dayOfWeek,
  )
  if (conditional) {
    shifts = shifts.filter((s) => conditional.allowedShiftCodes.includes(s.code))
    // Vérifier max heures
    if (conditional.maxHours) {
      shifts = shifts.filter((s) => s.effectiveHours <= conditional.maxHours!)
    }
  }

  // Filtrer par repos inter-shift
  const lastEnd = state.employeeLastEndTime.get(emp.id)
  if (lastEnd && lastEnd.day === ctx.dayOfWeek - 1) {
    shifts = shifts.filter((s) => {
      const rest = 24 - lastEnd.endTime + s.startTime
      return rest >= 11
    })
  }

  // Filtrer par bornes contractuelles (ne pas dépasser le max)
  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  shifts = shifts.filter((s) => currentHours + s.effectiveHours <= bounds.max)

  return shifts.sort((a, b) => a.sortOrder - b.sortOrder)
}

function chooseBestShift(
  available: ShiftTemplate[],
  remainingBudget: number,
  emp: Employee,
  state: SolverState,
): ShiftTemplate | null {
  if (available.length === 0) return null

  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  const hoursNeeded = bounds.min - currentHours // pour atteindre le minimum

  // Priorité 1 : Créneaux qui aident à atteindre le minimum contractuel
  // Priorité 2 : Créneaux qui ne dépassent pas trop le budget jour
  // Priorité 3 : Créneaux les plus courts si le budget est serré

  let best: ShiftTemplate | null = null
  let bestScore = -Infinity

  for (const shift of available) {
    let score = 0

    // Bonus si on est sous le minimum et que ce créneau aide
    if (hoursNeeded > 0) {
      score += Math.min(shift.effectiveHours, hoursNeeded) * 10
    }

    // Pénalité si on dépasse le budget jour
    if (shift.effectiveHours > remainingBudget) {
      score -= (shift.effectiveHours - remainingBudget) * 5
    } else {
      // Bonus pour se rapprocher du budget
      score += shift.effectiveHours
    }

    // Légère pénalité pour les très longs créneaux (préserver la flexibilité)
    if (shift.effectiveHours > 8) {
      score -= 2
    }

    if (score > bestScore) {
      bestScore = score
      best = shift
    }
  }

  return best
}

function pickRole(input: PlannerInput, emp: Employee): string {
  const empRoles = input.employeeRoles.filter((er) => er.employeeId === emp.id)
  return empRoles[0]?.roleId ?? ''
}

function calculateTotalAvailableHours(input: PlannerInput): number {
  let total = 0
  for (const emp of input.employees.filter((e) => !e.isManager && e.active)) {
    total += getWeeklyBounds(emp).max
  }
  return total
}

function buildEmployeeSummaries(
  input: PlannerInput,
  state: SolverState,
): EmployeeWeekSummary[] {
  return input.employees
    .filter((e) => e.active)
    .map((emp) => {
      const hours = state.employeeHours.get(emp.id) ?? 0
      const bounds = getWeeklyBounds(emp)
      const workDays = state.employeeWorkDays.get(emp.id) ?? new Set<number>()
      const daysOff = [0, 1, 2, 3, 4, 5, 6].filter((d) => !workDays.has(d))
      const entries = state.entries.filter((e) => e.employeeId === emp.id)

      let status: 'ok' | 'under' | 'over' = 'ok'
      if (hours < bounds.min) status = 'under'
      if (hours > bounds.max) status = 'over'

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        contractHours: emp.weeklyHours,
        plannedHours: hours,
        boundsMin: bounds.min,
        boundsMax: bounds.max,
        status,
        daysOff,
        totalMeals: entries.reduce((s, e) => s + e.meals, 0),
        totalBaskets: entries.reduce((s, e) => s + e.baskets, 0),
      }
    })
}

function buildDailySummaries(
  _input: PlannerInput,
  state: SolverState,
  dayContexts: DayAllocationContext[],
): DailySummary[] {
  return dayContexts.map((ctx) => {
    const plannedHours = state.dailyHours.get(ctx.dayOfWeek) ?? 0
    const productivity =
      plannedHours > 0 ? ctx.forecastedRevenue / plannedHours : 0

    const dayEntries = state.entries.filter(
      (e) => e.dayOfWeek === ctx.dayOfWeek,
    )

    return {
      date: ctx.date,
      dayOfWeek: ctx.dayOfWeek,
      forecastedRevenue: ctx.forecastedRevenue,
      plannedHours,
      productivity,
      coverageMidi: countCoverage(dayEntries, 12, 15),
      coverageApresMidi: countCoverage(dayEntries, 15, 18),
      coverageSoir: countCoverage(
        dayEntries,
        18,
        ctx.isSunday ? 21 : 24,
      ),
      openingStaff: countCoverage(dayEntries, 9.5, 10),
      closingStaff: dayEntries.filter((e) => e.endTime >= ctx.closingTime)
        .length,
      isDelestage: false,
      delestageReason: null,
    }
  })
}

function countCoverage(
  entries: PlanningEntry[],
  from: number,
  to: number,
): number {
  // Nombre minimum de personnes présentes dans la tranche
  let min = Infinity
  for (let h = from; h < to; h += 0.5) {
    const count = entries.filter((e) => e.startTime <= h && e.endTime > h).length
    if (count < min) min = count
  }
  return min === Infinity ? 0 : min
}

// --- Utilitaires ---

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getWeekNumber(isoDate: string): number {
  const d = new Date(isoDate)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  )
}
