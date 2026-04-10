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
 * Algorithme restructuré :
 * 1. Managers : copier horaires fixes
 * 2. Par jour (Sam→Dim→Ven→Mar→Mer→Jeu) :
 *    a. Ouverture : 1 personne à 9h30 (plus petit niveau). WE: +1 à 10h
 *    b. Fermeture : assurer ≥3 personnes à la fermeture (managers inclus)
 *    c. Couverture continue ≥2 de 11h à fermeture
 *    d. Barman : au moins 1 barman sur midi et soir
 *    e. Budget : remplir les heures restantes
 * 3. Rééquilibrage : salariés sous leur minimum → ajouter des shifts
 * 4. Validation complète
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

  for (const emp of input.employees) {
    state.employeeHours.set(emp.id, 0)
    state.employeeWorkDays.set(emp.id, new Set())
  }

  // Phase 1 : Managers (copier horaires fixes)
  applyManagerSchedules(input, state, planningId)

  // Phase 2 : Contextes d'allocation par jour
  const dayContexts = buildDayContexts(input, state)

  // Phase 3 : Délestage ?
  const totalBudget = dayContexts.reduce((s, d) => s + d.hoursBudget, 0)
  const totalAvailable = calculateTotalAvailableHours(input)
  const needsDelestage = isDelestageRequired(totalBudget, totalAvailable)

  if (needsDelestage) {
    state.warnings.push(
      `Délestage activé : budget total ${totalBudget.toFixed(1)}h > disponible ${totalAvailable.toFixed(1)}h`,
    )
  }

  // Phase 4 : En délestage, redistribuer le budget — priorité Ven/Sam/Dim
  if (needsDelestage) {
    redistributeBudget(dayContexts, totalAvailable, state)
  }

  // Phase 4b : Allocation par jour (priorité week-end)
  const dayOrder = [5, 6, 4, 1, 2, 3] // sam, dim, ven, mar, mer, jeu
  for (const dayOfWeek of dayOrder) {
    const ctx = dayContexts.find((d) => d.dayOfWeek === dayOfWeek)
    if (!ctx) continue
    allocateDay(input, state, ctx, planningId, needsDelestage)
  }

  // Phase 5 : Rééquilibrage — salariés sous leur minimum d'heures
  rebalanceMinimumHours(input, state, dayContexts, planningId)

  // Phase 6 : Construire le planning
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

  // Phase 7 : Validation
  const violations = validatePlanning({
    entries: state.entries,
    employees: input.employees.filter((e) => e.active),
    managerIds: input.employees.filter((e) => e.isManager).map((e) => e.id),
    shiftTemplates: input.shiftTemplates,
    closingTimeWeek: input.tenant.closingTimeWeek,
    closingTimeSunday: input.tenant.closingTimeSunday,
  })

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

// =====================================================
// MANAGER SCHEDULES
// =====================================================

function applyManagerSchedules(
  input: PlannerInput,
  state: SolverState,
  planningId: string,
): void {
  const managers = input.employees.filter((e) => e.isManager && e.active)

  for (const manager of managers) {
    const schedules = input.managerSchedules.filter((s) => s.employeeId === manager.id)
    for (const schedule of schedules) {
      if (!schedule.shiftTemplateId) continue

      const template = input.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId)
      const startTime = schedule.startTime ?? template?.startTime ?? 0
      const endTime = schedule.endTime ?? template?.endTime ?? 0
      const effectiveHours = endTime - startTime
      const date = addDays(input.weekStartDate, schedule.dayOfWeek)
      const roleId = input.employeeRoles.find((er) => er.employeeId === manager.id)?.roleId ?? ''

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
      state.employeeHours.set(manager.id, (state.employeeHours.get(manager.id) ?? 0) + effectiveHours)
      state.employeeWorkDays.get(manager.id)?.add(schedule.dayOfWeek)
      state.dailyHours.set(schedule.dayOfWeek, (state.dailyHours.get(schedule.dayOfWeek) ?? 0) + effectiveHours)
      state.employeeLastEndTime.set(manager.id, { day: schedule.dayOfWeek, endTime })
    }
  }
}

// =====================================================
// DAY CONTEXTS
// =====================================================

function buildDayContexts(input: PlannerInput, state: SolverState): DayAllocationContext[] {
  const contexts: DayAllocationContext[] = []

  for (let day = 1; day <= 6; day++) {
    const date = addDays(input.weekStartDate, day)
    const isSunday = day === 6
    const month = new Date(date).getMonth() + 1

    const forecast = input.dailyForecasts.find((f) => f.month === month && f.dayOfWeek === day)
    let forecastedRevenue = forecast?.forecastedRevenue ?? 0

    const override = input.eventOverrides?.find((e) => e.date === date)
    if (override) {
      forecastedRevenue *= 1 + override.revenueMultiplierPercent / 100
    }

    const hoursBudget = calculateHoursBudget(forecastedRevenue, input.tenant.productivityTarget)
    const managerHours = state.dailyHours.get(day) ?? 0
    const allocatableHours = calculateAllocatableHours(forecastedRevenue, input.tenant.productivityTarget, managerHours)
    const closingTime = isSunday ? input.tenant.closingTimeSunday : input.tenant.closingTimeWeek

    contexts.push({ dayOfWeek: day, date, isSunday, forecastedRevenue, hoursBudget, managerHours, allocatableHours, closingTime })
  }

  return contexts
}

// =====================================================
// ASSIGN SHIFT (helper)
// =====================================================

function assignShift(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  shift: ShiftTemplate,
  ctx: DayAllocationContext,
  planningId: string,
): void {
  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const roleId = pickRole(input, emp)

  state.entries.push({
    id: crypto.randomUUID(),
    planningId,
    employeeId: emp.id,
    roleId,
    date: ctx.date,
    dayOfWeek: ctx.dayOfWeek,
    shiftTemplateId: shift.id,
    startTime: shift.startTime,
    endTime: shift.endTime,
    effectiveHours: shift.effectiveHours,
    meals: shift.meals,
    baskets: shift.baskets,
  })

  state.employeeHours.set(emp.id, currentHours + shift.effectiveHours)
  state.employeeWorkDays.get(emp.id)?.add(ctx.dayOfWeek)
  state.dailyHours.set(ctx.dayOfWeek, (state.dailyHours.get(ctx.dayOfWeek) ?? 0) + shift.effectiveHours)
  state.employeeLastEndTime.set(emp.id, { day: ctx.dayOfWeek, endTime: shift.endTime })
}

/** Try to assign an employee a specific shift. Returns true if successful. */
function tryAssign(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  shift: ShiftTemplate,
  ctx: DayAllocationContext,
  planningId: string,
): boolean {
  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  if (currentHours + shift.effectiveHours > bounds.max) return false
  assignShift(input, state, emp, shift, ctx, planningId)
  return true
}

// =====================================================
// BUDGET REDISTRIBUTION (délestage)
// =====================================================

/**
 * En délestage, redistribue le budget heures pour prioriser Ven/Sam/Dim.
 *
 * Priorités :
 * - Sam, Dim : productivité cible (budget = CA/95, pas de réduction)
 * - Ven : légère réduction (-10%)
 * - Mar, Mer, Jeu : réduction proportionnelle pour tenir dans l'enveloppe
 *
 * Principe : on réserve d'abord le budget week-end, puis on répartit le reste.
 */
function redistributeBudget(
  dayContexts: DayAllocationContext[],
  totalAvailable: number,
  state: SolverState,
): void {
  // Heures managers déjà planifiées par jour
  const priorityDays = [5, 6] // Sam, Dim — intouchables
  const mediumDays = [4]      // Ven — légère réduction
  const lowDays = [1, 2, 3]   // Mar, Mer, Jeu — absorbent la réduction

  // Calculer le budget week-end (intouchable)
  let reservedHours = 0
  for (const ctx of dayContexts) {
    if (priorityDays.includes(ctx.dayOfWeek)) {
      reservedHours += ctx.hoursBudget
    }
  }

  // Budget vendredi (réduction 10%)
  for (const ctx of dayContexts) {
    if (mediumDays.includes(ctx.dayOfWeek)) {
      const reduced = ctx.hoursBudget * 0.9
      reservedHours += reduced
      ctx.hoursBudget = reduced
      ctx.allocatableHours = Math.max(0, reduced - (state.dailyHours.get(ctx.dayOfWeek) ?? 0))
    }
  }

  // Heures restantes pour Mar/Mer/Jeu
  const remainingForLow = Math.max(0, totalAvailable - reservedHours)
  const totalLowBudget = lowDays.reduce((s, d) => {
    const ctx = dayContexts.find((c) => c.dayOfWeek === d)
    return s + (ctx?.hoursBudget ?? 0)
  }, 0)

  // Répartir proportionnellement
  for (const ctx of dayContexts) {
    if (lowDays.includes(ctx.dayOfWeek) && totalLowBudget > 0) {
      const ratio = ctx.hoursBudget / totalLowBudget
      const newBudget = remainingForLow * ratio
      ctx.hoursBudget = newBudget
      ctx.allocatableHours = Math.max(0, newBudget - (state.dailyHours.get(ctx.dayOfWeek) ?? 0))
    }
  }
}

// =====================================================
// DAY ALLOCATION — multi-phase
// =====================================================

function allocateDay(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  needsDelestage: boolean,
): void {
  const nonManagers = input.employees.filter((e) => !e.isManager && e.active)

  // --- Phase A : Ouverture (1 personne à 9h30, plus petit niveau) ---
  ensureOpening(input, state, ctx, planningId, nonManagers)

  // --- Phase B : Fermeture (≥3 à la fermeture, managers inclus) ---
  ensureClosing(input, state, ctx, planningId, nonManagers)

  // --- Phase C : Couverture continue ≥2 de 11h à fermeture ---
  ensureContinuousCoverage(input, state, ctx, planningId, nonManagers)

  // --- Phase D : Barman midi & soir ---
  ensureBarmanCoverage(input, state, ctx, planningId, nonManagers)

  // --- Phase E : Budget (remplir les heures restantes) ---
  const currentDayHours = state.dailyHours.get(ctx.dayOfWeek) ?? 0
  let remainingHours = ctx.hoursBudget - currentDayHours

  const isDelestageDay =
    needsDelestage &&
    DELESTAGE_ORDER.some((d) => d.dayOfWeek === ctx.dayOfWeek) &&
    !NEVER_UNDERSTAFF.includes(ctx.dayOfWeek)

  const alreadyAssigned = new Set(
    state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek).map((e) => e.employeeId),
  )

  // Trier : contraints d'abord, shuffle parmi les égaux
  const sorted = [...nonManagers]
    .filter((emp) => !alreadyAssigned.has(emp.id))
    .sort((a, b) => {
      const aSlots = getAvailableShifts(input, state, a, ctx).length
      const bSlots = getAvailableShifts(input, state, b, ctx).length
      if (aSlots !== bSlots) return aSlots - bSlots
      return Math.random() - 0.5
    })

  for (const emp of sorted) {
    if (remainingHours <= 0) break
    if (!canWorkDay(input, state, emp, ctx)) continue

    const availableShifts = getAvailableShifts(input, state, emp, ctx)
    if (availableShifts.length === 0) continue

    const bestShift = chooseBestShift(availableShifts, remainingHours, emp, state, input, ctx)
    if (!bestShift) continue

    if (tryAssign(input, state, emp, bestShift, ctx, planningId)) {
      remainingHours -= bestShift.effectiveHours
    }
  }

  if (isDelestageDay && remainingHours > 0) {
    state.warnings.push(`Délestage jour ${ctx.dayOfWeek} : ${remainingHours.toFixed(1)}h non pourvues`)
  }
}

// =====================================================
// Phase A : OUVERTURE
// =====================================================

function ensureOpening(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  nonManagers: Employee[],
): void {
  const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
  const hasOpening = dayEntries.some((e) => e.startTime <= 9.5)

  if (hasOpening) return

  // 1 personne à 9h30, niveau le plus bas
  // Extra check: only candidates whose rest allows 9.5 start
  const assigned = assignFirstAvailable(input, state, ctx, planningId, nonManagers, {
    shiftFilter: (s) => s.startTime <= 9.5,
    sortEmployees: (a, b) => {
      // Exclude employees whose previous day ended too late for 9.5 start
      const aLast = state.employeeLastEndTime.get(a.id)
      const bLast = state.employeeLastEndTime.get(b.id)
      const aBlocked = aLast && aLast.day === ctx.dayOfWeek - 1 && (24 - aLast.endTime + 9.5) < 11
      const bBlocked = bLast && bLast.day === ctx.dayOfWeek - 1 && (24 - bLast.endTime + 9.5) < 11
      if (aBlocked && !bBlocked) return 1
      if (!aBlocked && bBlocked) return -1
      return a.level - b.level
    },
  })

  // Week-end : +1 renfort à 10h
  if (ctx.dayOfWeek >= 5 && assigned) {
    assignFirstAvailable(input, state, ctx, planningId, nonManagers, {
      shiftFilter: (s) => s.startTime <= 10,
      sortEmployees: (a, b) => a.level - b.level,
    })
  }
}

// =====================================================
// Phase B : FERMETURE (≥3 dont manager)
// =====================================================

function ensureClosing(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  nonManagers: Employee[],
): void {
  const minClosing = 3

  for (let attempt = 0; attempt < 8; attempt++) {
    const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
    const closingStaff = dayEntries.filter((e) => e.endTime >= ctx.closingTime)

    if (closingStaff.length >= minClosing) return

    // Try 1: assign someone new with a closing shift
    const assigned = assignFirstAvailable(input, state, ctx, planningId, nonManagers, {
      shiftFilter: (s) => s.endTime >= ctx.closingTime,
      sortEmployees: (a, b) => {
        // Prefer employees who NEED more hours (further from their minimum)
        const aHours = state.employeeHours.get(a.id) ?? 0
        const bHours = state.employeeHours.get(b.id) ?? 0
        const aNeeds = getWeeklyBounds(a).min - aHours
        const bNeeds = getWeeklyBounds(b).min - bHours
        if (bNeeds !== aNeeds) return bNeeds - aNeeds // most hours needed first
        if (b.level !== a.level) return b.level - a.level
        return Math.random() - 0.5
      },
    })

    if (!assigned) {
      // Try 2: any shift ending at closing, even if employee is at lower level
      const assigned2 = assignFirstAvailable(input, state, ctx, planningId, nonManagers, {
        shiftFilter: (s) => s.endTime >= ctx.closingTime,
        sortEmployees: () => Math.random() - 0.5, // anyone available
      })
      if (!assigned2) break
    }
  }
}

// =====================================================
// Phase C : COUVERTURE CONTINUE ≥2 de 11h à fermeture
// =====================================================

function ensureContinuousCoverage(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  nonManagers: Employee[],
): void {
  const startHour = 11
  const endHour = ctx.closingTime

  for (let attempt = 0; attempt < 8; attempt++) {
    // Trouver le premier trou de couverture
    const gap = findCoverageGap(state, ctx.dayOfWeek, startHour, endHour, 2)
    if (!gap) return // Couverture OK

    // Trouver un créneau qui couvre ce trou
    const assigned = assignFirstAvailable(input, state, ctx, planningId, nonManagers, {
      shiftFilter: (s) => s.startTime <= gap.hour && s.endTime > gap.hour,
      sortEmployees: (a, b) => {
        // Préférer quelqu'un qui couvre une large plage
        const aShifts = getAvailableShifts(input, state, a, ctx).filter((s) => s.startTime <= gap.hour && s.endTime > gap.hour)
        const bShifts = getAvailableShifts(input, state, b, ctx).filter((s) => s.startTime <= gap.hour && s.endTime > gap.hour)
        const aMax = Math.max(0, ...aShifts.map((s) => s.effectiveHours))
        const bMax = Math.max(0, ...bShifts.map((s) => s.effectiveHours))
        return bMax - aMax
      },
    })

    if (!assigned) {
      state.warnings.push(`Couverture : impossible de combler le trou à ${gap.hour}h le jour ${ctx.dayOfWeek}`)
      break
    }
  }
}

function findCoverageGap(
  state: SolverState,
  dayOfWeek: number,
  startHour: number,
  endHour: number,
  minCoverage: number,
): { hour: number; count: number } | null {
  const dayEntries = state.entries.filter((e) => e.dayOfWeek === dayOfWeek)

  for (let h = startHour; h < endHour; h += 0.5) {
    const count = dayEntries.filter((e) => e.startTime <= h && e.endTime > h).length
    if (count < minCoverage) {
      return { hour: h, count }
    }
  }
  return null
}

// =====================================================
// Phase D : BARMAN midi & soir
// =====================================================

function ensureBarmanCoverage(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  nonManagers: Employee[],
): void {
  const barmanRole = input.roles.find((r) => r.name.toLowerCase().includes('barman'))
  if (!barmanRole) return

  const barmanEmployees = nonManagers.filter((emp) => {
    const empRoles = input.employeeRoles.filter((er) => er.employeeId === emp.id)
    return empRoles.some((er) => er.roleId === barmanRole.id)
  })

  for (const period of [
    { maxStart: 12, minEnd: 15 },   // midi
    { maxStart: 18, minEnd: ctx.closingTime }, // soir
  ]) {
    const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
    const hasBarman = dayEntries.some((e) => {
      const empRoles = input.employeeRoles.filter((er) => er.employeeId === e.employeeId)
      return e.startTime <= period.maxStart && e.endTime >= period.minEnd &&
        empRoles.some((er) => er.roleId === barmanRole.id)
    })

    if (!hasBarman) {
      for (const emp of barmanEmployees) {
        if (state.employeeWorkDays.get(emp.id)?.has(ctx.dayOfWeek)) continue
        if (!canWorkDay(input, state, emp, ctx)) continue

        const shifts = getAvailableShifts(input, state, emp, ctx)
          .filter((s) => s.startTime <= period.maxStart && s.endTime >= period.minEnd)
        if (shifts.length === 0) continue

        if (tryAssign(input, state, emp, shifts[0], ctx, planningId)) break
      }
    }
  }
}

// =====================================================
// Phase 5 : RÉÉQUILIBRAGE (minimum heures)
// =====================================================

function rebalanceMinimumHours(
  input: PlannerInput,
  state: SolverState,
  dayContexts: DayAllocationContext[],
  planningId: string,
): void {
  const nonManagers = input.employees.filter((e) => !e.isManager && e.active)

  // Trier par écart au minimum (les plus en dessous d'abord)
  const underMin = nonManagers
    .map((emp) => {
      const hours = state.employeeHours.get(emp.id) ?? 0
      const bounds = getWeeklyBounds(emp)
      return { emp, hours, deficit: bounds.min - hours }
    })
    .filter((x) => x.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)

  for (const { emp, deficit } of underMin) {
    let remaining = deficit

    // Essayer chaque jour où l'employé n'est pas encore planifié
    const dayOrder = [5, 6, 4, 1, 2, 3] // sam, dim, ven d'abord
    for (const dayOfWeek of dayOrder) {
      if (remaining <= 0) break

      const ctx = dayContexts.find((d) => d.dayOfWeek === dayOfWeek)
      if (!ctx) continue
      if (state.employeeWorkDays.get(emp.id)?.has(dayOfWeek)) continue
      if (!canWorkDay(input, state, emp, ctx)) continue

      const shifts = getAvailableShifts(input, state, emp, ctx)
      if (shifts.length === 0) continue

      // Choisir le créneau qui se rapproche le plus du déficit restant
      const sorted = [...shifts].sort((a, b) => {
        const aDiff = Math.abs(a.effectiveHours - remaining)
        const bDiff = Math.abs(b.effectiveHours - remaining)
        return aDiff - bDiff
      })

      const shift = sorted[0]
      if (tryAssign(input, state, emp, shift, ctx, planningId)) {
        remaining -= shift.effectiveHours
      }
    }

    if (remaining > 0) {
      state.warnings.push(
        `${emp.firstName} ${emp.lastName} : ${remaining.toFixed(1)}h sous le minimum (impossible à combler)`,
      )
    }
  }
}

// =====================================================
// GENERIC HELPER : assign first available employee
// =====================================================

function assignFirstAvailable(
  input: PlannerInput,
  state: SolverState,
  ctx: DayAllocationContext,
  planningId: string,
  candidates: Employee[],
  opts: {
    shiftFilter: (s: ShiftTemplate) => boolean
    sortEmployees: (a: Employee, b: Employee) => number
  },
): boolean {
  const alreadyAssigned = new Set(
    state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek).map((e) => e.employeeId),
  )

  const sorted = [...candidates]
    .filter((emp) => !alreadyAssigned.has(emp.id))
    .filter((emp) => canWorkDay(input, state, emp, ctx))
    .filter((emp) => {
      const shifts = getAvailableShifts(input, state, emp, ctx)
      return shifts.some(opts.shiftFilter)
    })
    .sort(opts.sortEmployees)

  for (const emp of sorted) {
    const shifts = getAvailableShifts(input, state, emp, ctx).filter(opts.shiftFilter)
    if (shifts.length === 0) continue

    // Smart shift selection: don't always pick longest
    // Penalize shifts ending at midnight if employee might be needed next morning
    const nextDayOfWeek = ctx.dayOfWeek + 1
    const mightBeNeededTomorrow = nextDayOfWeek <= 6 &&
      !state.employeeWorkDays.get(emp.id)?.has(nextDayOfWeek) &&
      !input.unavailabilities.some((u) =>
        u.employeeId === emp.id && u.type === 'fixed' && u.dayOfWeek === nextDayOfWeek,
      )

    const scored = shifts.map((s) => {
      let score = s.effectiveHours // base: longer = better coverage
      // Heavy penalty for midnight finish if needed tomorrow (blocks morning shifts)
      if (s.endTime >= 24 && mightBeNeededTomorrow) {
        score -= 4
      }
      // Small random variation
      score += (Math.random() - 0.5)
      return { s, score }
    })
    scored.sort((a, b) => b.score - a.score)
    const shift = scored[0].s

    if (tryAssign(input, state, emp, shift, ctx, planningId)) {
      return true
    }
  }

  return false
}

// =====================================================
// CAN WORK DAY
// =====================================================

function canWorkDay(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  ctx: DayAllocationContext,
): boolean {
  if (ctx.dayOfWeek === 0) return false
  if (state.employeeWorkDays.get(emp.id)?.has(ctx.dayOfWeek)) return false

  // Indisponibilité fixe
  if (input.unavailabilities.some((u) =>
    u.employeeId === emp.id && u.type === 'fixed' && u.dayOfWeek === ctx.dayOfWeek,
  )) return false

  // Indisponibilité ponctuelle — OFF complet only (no availableFrom/Until)
  const punctual = input.unavailabilities.find((u) =>
    u.employeeId === emp.id && u.type === 'punctual' && u.specificDate === ctx.date,
  )
  if (punctual && !punctual.availableFrom && !punctual.availableUntil) return false
  // If punctual has time restrictions, employee can still work — shifts filtered in getAvailableShifts

  // Repos inter-shift (11h)
  const lastEnd = state.employeeLastEndTime.get(emp.id)
  if (lastEnd && lastEnd.day === ctx.dayOfWeek - 1) {
    if (checkRestBetweenShifts(lastEnd.endTime, 9.5)) return false
  }

  // Max 5 jours travaillés (+ lundi off = 2 jours off minimum)
  const workDays = state.employeeWorkDays.get(emp.id)
  if (workDays && workDays.size >= 5) return false

  return true
}

// =====================================================
// AVAILABLE SHIFTS
// =====================================================

function getAvailableShifts(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  ctx: DayAllocationContext,
): ShiftTemplate[] {
  const isSunday = ctx.dayOfWeek === 6
  const isSaturday = ctx.dayOfWeek === 5

  let shifts = input.shiftTemplates.filter((s) => {
    if (isSunday) return s.applicability === 'sunday'
    if (isSaturday) return s.applicability === 'tue_sat' || s.applicability === 'sat_only'
    return s.applicability === 'tue_sat'
  })

  // Disponibilité conditionnelle (récurrente)
  const conditional = input.conditionalAvailabilities.find(
    (ca) => ca.employeeId === emp.id && ca.dayOfWeek === ctx.dayOfWeek,
  )
  if (conditional) {
    shifts = shifts.filter((s) => conditional.allowedShiftCodes.includes(s.code))
    if (conditional.maxHours) {
      shifts = shifts.filter((s) => s.effectiveHours <= conditional.maxHours!)
    }
  }

  // Contrainte ponctuelle avec restriction horaire (availableFrom / availableUntil)
  const punctualTime = input.unavailabilities.find((u) =>
    u.employeeId === emp.id && u.type === 'punctual' && u.specificDate === ctx.date &&
    (u.availableFrom != null || u.availableUntil != null),
  )
  if (punctualTime) {
    if (punctualTime.availableFrom != null) {
      // Dispo seulement à partir de X h → shift doit commencer >= availableFrom
      shifts = shifts.filter((s) => s.startTime >= punctualTime.availableFrom!)
    }
    if (punctualTime.availableUntil != null) {
      // Doit partir avant X h → shift doit finir <= availableUntil
      shifts = shifts.filter((s) => s.endTime <= punctualTime.availableUntil!)
    }
  }

  // Repos inter-shift — backward (yesterday → today)
  const lastEnd = state.employeeLastEndTime.get(emp.id)
  if (lastEnd && lastEnd.day === ctx.dayOfWeek - 1) {
    shifts = shifts.filter((s) => (24 - lastEnd.endTime + s.startTime) >= 11)
  }

  // Repos inter-shift — forward (today → tomorrow)
  // If employee already has a shift tomorrow, ensure this shift's end allows 11h rest
  const tomorrowEntry = state.entries.find(
    (e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek + 1,
  )
  if (tomorrowEntry) {
    shifts = shifts.filter((s) => (24 - s.endTime + tomorrowEntry.startTime) >= 11)
  }

  // Bornes contractuelles
  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  shifts = shifts.filter((s) => currentHours + s.effectiveHours <= bounds.max)

  return shifts.sort((a, b) => a.sortOrder - b.sortOrder)
}

// =====================================================
// CHOOSE BEST SHIFT
// =====================================================

function chooseBestShift(
  available: ShiftTemplate[],
  remainingBudget: number,
  emp: Employee,
  state: SolverState,
  input: PlannerInput,
  ctx: DayAllocationContext,
): ShiftTemplate | null {
  if (available.length === 0) return null

  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  const hoursNeeded = bounds.min - currentHours

  // Check if employee might be needed tomorrow (don't block them with midnight shift)
  const nextDay = ctx.dayOfWeek + 1
  const mightWorkTomorrow = nextDay <= 6 &&
    !state.employeeWorkDays.get(emp.id)?.has(nextDay) &&
    !input.unavailabilities.some((u) =>
      u.employeeId === emp.id && u.type === 'fixed' && u.dayOfWeek === nextDay,
    )

  // Count how many times this employee already has each shift code this week
  const empEntries = state.entries.filter((e) => e.employeeId === emp.id)
  const shiftCodeCount = new Map<string, number>()
  for (const e of empEntries) {
    shiftCodeCount.set(e.shiftTemplateId, (shiftCodeCount.get(e.shiftTemplateId) ?? 0) + 1)
  }

  const scored = available.map((shift) => {
    let score = 0

    // Bonus pour atteindre le minimum contractuel
    if (hoursNeeded > 0) {
      score += Math.min(shift.effectiveHours, hoursNeeded) * 10
    }

    // Pénalité si dépasse le budget jour
    if (shift.effectiveHours > remainingBudget) {
      score -= (shift.effectiveHours - remainingBudget) * 5
    } else {
      score += shift.effectiveHours
    }

    // Pénalité pour les très longs créneaux (11h)
    if (shift.effectiveHours > 8) score -= 2

    // Pénalité pour shift finissant à minuit si l'employé peut travailler demain
    if (shift.endTime >= 24 && mightWorkTomorrow) {
      score -= 3
    }

    // Pénalité pour répétition du même créneau (varier les horaires)
    const timesUsed = shiftCodeCount.get(shift.id) ?? 0
    if (timesUsed > 0) score -= timesUsed * 3

    // Variation aléatoire
    score += (Math.random() - 0.5) * 2

    return { shift, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.shift ?? null
}

// =====================================================
// HELPERS
// =====================================================

function pickRole(input: PlannerInput, emp: Employee): string {
  return input.employeeRoles.find((er) => er.employeeId === emp.id)?.roleId ?? ''
}

function calculateTotalAvailableHours(input: PlannerInput): number {
  let total = 0
  for (const emp of input.employees.filter((e) => !e.isManager && e.active)) {
    total += getWeeklyBounds(emp).max
  }
  return total
}

function buildEmployeeSummaries(input: PlannerInput, state: SolverState): EmployeeWeekSummary[] {
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
    const productivity = plannedHours > 0 ? ctx.forecastedRevenue / plannedHours : 0
    const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)

    return {
      date: ctx.date,
      dayOfWeek: ctx.dayOfWeek,
      forecastedRevenue: ctx.forecastedRevenue,
      plannedHours,
      productivity,
      coverageMidi: countCoverage(dayEntries, 12, 15),
      coverageApresMidi: countCoverage(dayEntries, 15, 18),
      coverageSoir: countCoverage(dayEntries, 18, ctx.isSunday ? 21 : 24),
      openingStaff: dayEntries.filter((e) => e.startTime <= 9.5).length,
      closingStaff: dayEntries.filter((e) => e.endTime >= ctx.closingTime).length,
      isDelestage: false,
      delestageReason: null,
    }
  })
}

function countCoverage(entries: PlanningEntry[], from: number, to: number): number {
  let min = Infinity
  for (let h = from; h < to; h += 0.5) {
    const count = entries.filter((e) => e.startTime <= h && e.endTime > h).length
    if (count < min) min = count
  }
  return min === Infinity ? 0 : min
}

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
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
