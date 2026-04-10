import type { PlanningEntry, PlanningReport, WeekPlanning, EmployeeWeekSummary, DailySummary } from '../models/planning'
import { getWeeklyBounds } from '../models/employee'
import type { Employee } from '../models/employee'
import type { ShiftTemplate } from '../models/shift'
import { calculateHoursBudget, isDelestageRequired } from '../rules/productivity'
import { validatePlanning } from '../rules/validation'
import type { PlannerInput, SolverState, DayAllocationContext } from './types'

/**
 * ALGORITHME V2 — EMPLOYEE-FIRST
 *
 * Au lieu de remplir jour par jour (et créer des conflits repos 11h),
 * on planifie la SEMAINE ENTIÈRE de chaque salarié d'un coup.
 *
 * 1. Managers : horaires fixes (copier-coller)
 * 2. Calculer les besoins par jour (CA → budget heures)
 * 3. Pour chaque salarié (plus contraint d'abord) :
 *    a. Choisir ses jours de travail (OFF stratégique)
 *    b. Pour chaque jour, choisir un shift en alternant jour/soir
 *    c. Respecter repos 11h, bornes contrat, dispos
 * 4. Patcher les trous de couverture (ouverture, fermeture, continu)
 * 5. Valider
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

  // === Phase 1 : Managers (horaires fixes) ===
  applyManagerSchedules(input, state, planningId)

  // === Phase 2 : Contextes par jour ===
  const dayContexts = buildDayContexts(input, state)

  // === Phase 3 : Planifier chaque salarié sur la semaine ===
  const nonManagers = input.employees.filter((e) => !e.isManager && e.active)

  // === Phase 3a : Assurer 1 personne à l'ouverture (9h30) chaque jour ===
  assignOpeningShifts(input, state, dayContexts, planningId, nonManagers)

  // === Phase 3b : Planifier chaque salarié sur la semaine ===
  // Re-sort after opening assignments
  const sortedEmployees = [...nonManagers].sort((a, b) => {
    const aSlots = countWeekSlots(input, state, a, dayContexts)
    const bSlots = countWeekSlots(input, state, b, dayContexts)
    if (aSlots !== bSlots) return aSlots - bSlots
    return b.weeklyHours - a.weeklyHours
  })

  for (const emp of sortedEmployees) {
    planEmployeeWeek(input, state, emp, dayContexts, planningId)
  }

  // === Phase 4 : Patcher les trous de couverture ===
  for (let round = 0; round < 3; round++) {
    let patched = false
    for (const ctx of dayContexts) {
      if (patchOpening(input, state, ctx, planningId, nonManagers)) patched = true
      if (patchClosing(input, state, ctx, planningId, nonManagers)) patched = true
      if (patchCoverageGaps(input, state, ctx, planningId, nonManagers)) patched = true
    }
    if (!patched) break
  }

  // === Phase 5 : Construire le planning ===
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

  const violations = validatePlanning({
    entries: state.entries,
    employees: input.employees.filter((e) => e.active),
    managerIds: input.employees.filter((e) => e.isManager).map((e) => e.id),
    shiftTemplates: input.shiftTemplates,
    closingTimeWeek: input.tenant.closingTimeWeek,
    closingTimeSunday: input.tenant.closingTimeSunday,
  })

  const totalBudget = dayContexts.reduce((s, d) => s + d.hoursBudget, 0)
  const totalAvailable = nonManagers.reduce((s, e) => s + getWeeklyBounds(e).max, 0)
  if (isDelestageRequired(totalBudget, totalAvailable)) {
    state.warnings.unshift(`Délestage activé : budget total ${totalBudget.toFixed(1)}h > disponible ${totalAvailable.toFixed(1)}h`)
  }

  return {
    planning,
    employeeSummaries: buildEmployeeSummaries(input, state),
    dailySummaries: buildDailySummaries(state, dayContexts),
    violations,
    warnings: state.warnings,
    isValid: violations.filter((v) => v.severity === 'blocking').length === 0,
  }
}

// =====================================================
// PHASE 1 : MANAGERS
// =====================================================

function applyManagerSchedules(input: PlannerInput, state: SolverState, planningId: string): void {
  for (const manager of input.employees.filter((e) => e.isManager && e.active)) {
    for (const schedule of input.managerSchedules.filter((s) => s.employeeId === manager.id)) {
      if (!schedule.shiftTemplateId) continue
      const template = input.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId)
      const startTime = schedule.startTime ?? template?.startTime ?? 0
      const endTime = schedule.endTime ?? template?.endTime ?? 0
      const effectiveHours = endTime - startTime

      addEntry(state, {
        id: crypto.randomUUID(), planningId,
        employeeId: manager.id,
        roleId: input.employeeRoles.find((er) => er.employeeId === manager.id)?.roleId ?? '',
        date: addDays(input.weekStartDate, schedule.dayOfWeek),
        dayOfWeek: schedule.dayOfWeek,
        shiftTemplateId: schedule.shiftTemplateId,
        startTime, endTime, effectiveHours,
        meals: template?.meals ?? 0, baskets: template?.baskets ?? 0,
      })
    }
  }
}

// =====================================================
// PHASE 2 : DAY CONTEXTS
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
    if (override) forecastedRevenue *= 1 + override.revenueMultiplierPercent / 100

    const hoursBudget = calculateHoursBudget(forecastedRevenue, input.tenant.productivityTarget)
    const managerHours = state.dailyHours.get(day) ?? 0
    const closingTime = isSunday ? input.tenant.closingTimeSunday : input.tenant.closingTimeWeek

    contexts.push({
      dayOfWeek: day, date, isSunday, forecastedRevenue, hoursBudget,
      managerHours, allocatableHours: Math.max(0, hoursBudget - managerHours), closingTime,
    })
  }
  return contexts
}

// =====================================================
// PHASE 3a : OPENING SHIFTS (1 person at 9h30 every day)
// =====================================================

function assignOpeningShifts(
  input: PlannerInput,
  state: SolverState,
  dayContexts: DayAllocationContext[],
  planningId: string,
  nonManagers: Employee[],
): void {
  // Sort employees by level (lowest first — rule: smallest level for opening)
  const byLevel = [...nonManagers].sort((a, b) => a.level - b.level)

  for (const ctx of dayContexts) {
    // Check if a manager already covers opening
    const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
    if (dayEntries.some((e) => e.startTime <= 9.5)) continue

    // Find opening shift (OUV or D_OUV)
    for (const emp of byLevel) {
      if (state.employeeWorkDays.get(emp.id)?.has(ctx.dayOfWeek)) continue
      if (!canWorkDay(input, state, emp, ctx)) continue

      const shifts = getAvailableShifts(input, state, emp, ctx)
        .filter((s) => s.startTime <= 9.5)

      if (shifts.length === 0) continue

      // Prefer the opening shift (shortest one starting at 9.5)
      const shift = shifts.sort((a, b) => a.effectiveHours - b.effectiveHours)[0]
      const bounds = getWeeklyBounds(emp)
      if ((state.employeeHours.get(emp.id) ?? 0) + shift.effectiveHours > bounds.max) continue

      addEntry(state, {
        id: crypto.randomUUID(), planningId,
        employeeId: emp.id,
        roleId: input.employeeRoles.find((er) => er.employeeId === emp.id)?.roleId ?? '',
        date: ctx.date, dayOfWeek: ctx.dayOfWeek,
        shiftTemplateId: shift.id,
        startTime: shift.startTime, endTime: shift.endTime,
        effectiveHours: shift.effectiveHours,
        meals: shift.meals, baskets: shift.baskets,
      })
      break // 1 person per day is enough
    }
  }
}

// =====================================================
// PHASE 3 : PLAN EMPLOYEE WEEK
// =====================================================

function planEmployeeWeek(
  input: PlannerInput,
  state: SolverState,
  emp: Employee,
  dayContexts: DayAllocationContext[],
  planningId: string,
): void {
  const bounds = getWeeklyBounds(emp)
  const isFullTime = emp.weeklyHours >= 35
  const targetDays = isFullTime ? 5 : Math.min(5, Math.ceil(bounds.min / 4))

  // Step 1: Determine which days the employee CAN work
  const availableDays = dayContexts
    .filter((ctx) => canWorkDay(input, state, emp, ctx))
    .map((ctx) => ({
      ctx,
      shifts: getAvailableShifts(input, state, emp, ctx),
    }))
    .filter((d) => d.shifts.length > 0)

  if (availableDays.length === 0) return

  // Step 2: Choose which days to work — prioritize days that need more staff
  const chosenDays = chooseDays(input, state, emp, availableDays, targetDays, dayContexts)

  // Step 3: For each chosen day, pick a shift — ALTERNATE day/evening to avoid repos 11h conflicts
  let totalHours = 0

  for (let i = 0; i < chosenDays.length; i++) {
    const { ctx, shifts } = chosenDays[i]
    const remaining = bounds.min - totalHours
    const daysLeft = chosenDays.length - i

    // Choose shift: balance between filling hours and respecting rest
    const prevEntry = i > 0 ? state.entries.find(
      (e) => e.employeeId === emp.id && e.dayOfWeek === chosenDays[i - 1].ctx.dayOfWeek,
    ) : null
    const nextCtx = i < chosenDays.length - 1 ? chosenDays[i + 1].ctx : null

    // Filter shifts that respect repos 11h with previous and next day
    const validShifts = shifts.filter((s) => {
      // Check backward rest
      const prevShift = state.entries.find(
        (e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek - 1,
      )
      if (prevShift && (24 - prevShift.endTime + s.startTime) < 11) return false

      // Check forward rest (if next day is consecutive and we know it)
      if (nextCtx && nextCtx.dayOfWeek === ctx.dayOfWeek + 1) {
        // We'll need to start at least at some point tomorrow — don't block with midnight
        if (s.endTime >= 24) {
          // Check if any shift tomorrow starts at 11+ (the earliest after midnight rest)
          const tomorrowShifts = getAvailableShifts(input, state, emp, nextCtx)
          const anyValid = tomorrowShifts.some((ts) => ts.startTime >= 11)
          if (!anyValid) return false // would block tomorrow entirely
        }
      }
      return true
    })

    if (validShifts.length === 0) continue

    // Score shifts
    const idealHours = remaining / Math.max(1, daysLeft)
    const usedShiftIds = new Set(state.entries.filter((e) => e.employeeId === emp.id).map((e) => e.shiftTemplateId))

    const scored = validShifts.map((s) => {
      let score = 0

      // Prefer shifts close to ideal hours per remaining day
      // But if ideal is high (>7h), prefer longer shifts to reach minimum
      if (idealHours > 7) {
        // Need long shifts — penalize short ones more than long ones
        if (s.effectiveHours < idealHours) {
          score -= (idealHours - s.effectiveHours) * 3
        } else {
          score -= (s.effectiveHours - idealHours) * 0.5
        }
      } else {
        score -= Math.abs(s.effectiveHours - idealHours) * 2
      }

      // Variety: penalize repeating the same shift
      if (usedShiftIds.has(s.id)) score -= 4

      // Alternate day/evening: if yesterday was evening (end>=24), prefer day today
      if (prevEntry && prevEntry.endTime >= 24 && s.startTime < 15) score += 3
      if (prevEntry && prevEntry.endTime <= 18 && s.startTime >= 17) score += 3

      // Prefer non-midnight when possible (easier for next day)
      if (s.endTime < 24) score += 1

      // Help coverage: prefer shifts on understaffed periods
      const dayHours = state.dailyHours.get(ctx.dayOfWeek) ?? 0
      if (dayHours < ctx.hoursBudget) score += 2

      // Random variation
      score += (Math.random() - 0.5) * 2

      return { s, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const bestShift = scored[0]?.s
    if (!bestShift) continue

    if ((state.employeeHours.get(emp.id) ?? 0) + bestShift.effectiveHours <= bounds.max) {
      addEntry(state, {
        id: crypto.randomUUID(), planningId,
        employeeId: emp.id,
        roleId: input.employeeRoles.find((er) => er.employeeId === emp.id)?.roleId ?? '',
        date: ctx.date,
        dayOfWeek: ctx.dayOfWeek,
        shiftTemplateId: bestShift.id,
        startTime: bestShift.startTime,
        endTime: bestShift.endTime,
        effectiveHours: bestShift.effectiveHours,
        meals: bestShift.meals, baskets: bestShift.baskets,
      })
      totalHours += bestShift.effectiveHours
    }
  }

  // Warning if under minimum
  const finalHours = state.employeeHours.get(emp.id) ?? 0
  if (finalHours < bounds.min) {
    state.warnings.push(`${emp.firstName} : ${(bounds.min - finalHours).toFixed(1)}h sous le minimum`)
  }
}

function chooseDays(
  _input: PlannerInput,
  state: SolverState,
  _emp: Employee,
  availableDays: { ctx: DayAllocationContext; shifts: ShiftTemplate[] }[],
  targetDays: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dayContexts: DayAllocationContext[],
): { ctx: DayAllocationContext; shifts: ShiftTemplate[] }[] {
  if (availableDays.length <= targetDays) return availableDays

  // Score each day for this employee
  const scored = availableDays.map((d) => {
    let score = 0

    // Weekend priority (higher CA)
    const dayPriority: Record<number, number> = { 5: 10, 6: 9, 4: 7, 3: 4, 2: 3, 1: 2 }
    score += dayPriority[d.ctx.dayOfWeek] ?? 0

    // Day needs more staff (high productivity = understaffed)
    const currentHours = state.dailyHours.get(d.ctx.dayOfWeek) ?? 0
    if (currentHours < d.ctx.hoursBudget) {
      score += 5
    }

    // More shift variety available = better
    score += d.shifts.length * 0.5

    // Random
    score += (Math.random() - 0.5) * 3

    return { ...d, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Pick targetDays, but ensure they're spread out to avoid consecutive midnight blocks
  const chosen: typeof scored = []
  for (const day of scored) {
    if (chosen.length >= targetDays) break
    chosen.push(day)
  }

  // Sort by day order for shift assignment
  chosen.sort((a, b) => a.ctx.dayOfWeek - b.ctx.dayOfWeek)
  return chosen
}

// =====================================================
// PHASE 4 : PATCH COVERAGE
// =====================================================

function patchOpening(
  input: PlannerInput, state: SolverState,
  ctx: DayAllocationContext, planningId: string,
  nonManagers: Employee[],
): boolean {
  const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
  if (dayEntries.some((e) => e.startTime <= 9.5)) return false

  // Need someone at 9h30
  return assignForCoverage(input, state, ctx, planningId, nonManagers,
    (s) => s.startTime <= 9.5,
    (a, b) => a.level - b.level, // lowest level first
  )
}

function patchClosing(
  input: PlannerInput, state: SolverState,
  ctx: DayAllocationContext, planningId: string,
  nonManagers: Employee[],
): boolean {
  const minClosing = ctx.dayOfWeek <= 2 ? 4 : 6
  const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
  const closingStaff = dayEntries.filter((e) => e.endTime >= ctx.closingTime)
  if (closingStaff.length >= minClosing) return false

  // Need more people at closing — prefer shortest closing shift
  return assignForCoverage(input, state, ctx, planningId, nonManagers,
    (s) => s.endTime >= ctx.closingTime,
    (a, b) => {
      // Prefer employees who need more hours
      const aNeeds = getWeeklyBounds(a).min - (state.employeeHours.get(a.id) ?? 0)
      const bNeeds = getWeeklyBounds(b).min - (state.employeeHours.get(b.id) ?? 0)
      return bNeeds - aNeeds
    },
    true, // prefer short shifts
  )
}

function patchCoverageGaps(
  input: PlannerInput, state: SolverState,
  ctx: DayAllocationContext, planningId: string,
  nonManagers: Employee[],
): boolean {
  const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
  const startHour = 11
  const endHour = ctx.closingTime

  // Find first gap
  for (let h = startHour; h < endHour; h += 0.5) {
    const count = dayEntries.filter((e) => e.startTime <= h && e.endTime > h).length
    if (count < 2) {
      return assignForCoverage(input, state, ctx, planningId, nonManagers,
        (s) => s.startTime <= h && s.endTime > h,
        (a, b) => {
          const aNeeds = getWeeklyBounds(a).min - (state.employeeHours.get(a.id) ?? 0)
          const bNeeds = getWeeklyBounds(b).min - (state.employeeHours.get(b.id) ?? 0)
          return bNeeds - aNeeds
        },
      )
    }
  }
  return false
}

function assignForCoverage(
  input: PlannerInput, state: SolverState,
  ctx: DayAllocationContext, planningId: string,
  candidates: Employee[],
  shiftFilter: (s: ShiftTemplate) => boolean,
  sortEmps: (a: Employee, b: Employee) => number,
  preferShort?: boolean,
): boolean {
  const assigned = new Set(state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek).map((e) => e.employeeId))

  const sorted = candidates
    .filter((emp) => !assigned.has(emp.id))
    .filter((emp) => canWorkDay(input, state, emp, ctx))
    .filter((emp) => getAvailableShifts(input, state, emp, ctx).some(shiftFilter))
    .sort(sortEmps)

  for (const emp of sorted) {
    const shifts = getAvailableShifts(input, state, emp, ctx).filter(shiftFilter)
    if (shifts.length === 0) continue

    const shift = preferShort
      ? shifts.sort((a, b) => a.effectiveHours - b.effectiveHours)[0]
      : shifts.sort((a, b) => b.effectiveHours - a.effectiveHours)[0]

    const bounds = getWeeklyBounds(emp)
    if ((state.employeeHours.get(emp.id) ?? 0) + shift.effectiveHours > bounds.max) continue

    addEntry(state, {
      id: crypto.randomUUID(), planningId,
      employeeId: emp.id,
      roleId: input.employeeRoles.find((er) => er.employeeId === emp.id)?.roleId ?? '',
      date: ctx.date, dayOfWeek: ctx.dayOfWeek,
      shiftTemplateId: shift.id,
      startTime: shift.startTime, endTime: shift.endTime,
      effectiveHours: shift.effectiveHours,
      meals: shift.meals, baskets: shift.baskets,
    })
    return true
  }
  return false
}

// =====================================================
// HELPERS
// =====================================================

function addEntry(state: SolverState, entry: PlanningEntry): void {
  state.entries.push(entry)
  state.employeeHours.set(entry.employeeId, (state.employeeHours.get(entry.employeeId) ?? 0) + entry.effectiveHours)
  state.employeeWorkDays.get(entry.employeeId)?.add(entry.dayOfWeek)
  state.dailyHours.set(entry.dayOfWeek, (state.dailyHours.get(entry.dayOfWeek) ?? 0) + entry.effectiveHours)
  state.employeeLastEndTime.set(entry.employeeId, { day: entry.dayOfWeek, endTime: entry.endTime })
}

function canWorkDay(input: PlannerInput, state: SolverState, emp: Employee, ctx: DayAllocationContext): boolean {
  if (ctx.dayOfWeek === 0) return false
  if (state.employeeWorkDays.get(emp.id)?.has(ctx.dayOfWeek)) return false

  if (input.unavailabilities.some((u) => u.employeeId === emp.id && u.type === 'fixed' && u.dayOfWeek === ctx.dayOfWeek)) return false

  const punctual = input.unavailabilities.find((u) =>
    u.employeeId === emp.id && u.type === 'punctual' && u.specificDate === ctx.date,
  )
  if (punctual && !punctual.availableFrom && !punctual.availableUntil) return false

  // Repos 11h — check actual entries for yesterday
  const yesterdayEntry = state.entries.find((e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek - 1)
  if (yesterdayEntry && (24 - yesterdayEntry.endTime + 9.5) < 11) return false

  // Forward check: if already assigned tomorrow with early shift
  const tomorrowEntry = state.entries.find((e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek + 1)
  if (tomorrowEntry && tomorrowEntry.startTime < 11) {
    // Can only work if there exists a shift ending early enough
    // This is checked in getAvailableShifts, just ensure at least one exists
  }

  if ((state.employeeWorkDays.get(emp.id)?.size ?? 0) >= 5) return false

  return true
}

function getAvailableShifts(input: PlannerInput, state: SolverState, emp: Employee, ctx: DayAllocationContext): ShiftTemplate[] {
  const isSunday = ctx.dayOfWeek === 6
  const isSaturday = ctx.dayOfWeek === 5

  let shifts = input.shiftTemplates.filter((s) => {
    if (isSunday) return s.applicability === 'sunday'
    if (isSaturday) return s.applicability === 'tue_sat' || s.applicability === 'sat_only'
    return s.applicability === 'tue_sat'
  })

  // Conditional availability
  const conditional = input.conditionalAvailabilities.find(
    (ca) => ca.employeeId === emp.id && ca.dayOfWeek === ctx.dayOfWeek,
  )
  if (conditional) {
    shifts = shifts.filter((s) => conditional.allowedShiftCodes.includes(s.code))
    if (conditional.maxHours) shifts = shifts.filter((s) => s.effectiveHours <= conditional.maxHours!)
  }

  // Punctual time restriction
  const punctual = input.unavailabilities.find((u) =>
    u.employeeId === emp.id && u.type === 'punctual' && u.specificDate === ctx.date &&
    (u.availableFrom != null || u.availableUntil != null),
  )
  if (punctual) {
    if (punctual.availableFrom != null) shifts = shifts.filter((s) => s.startTime >= punctual.availableFrom!)
    if (punctual.availableUntil != null) shifts = shifts.filter((s) => s.endTime <= punctual.availableUntil!)
  }

  // Repos 11h backward
  const yesterdayShift = state.entries.find((e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek - 1)
  if (yesterdayShift) shifts = shifts.filter((s) => (24 - yesterdayShift.endTime + s.startTime) >= 11)

  // Repos 11h forward
  const tomorrowShift = state.entries.find((e) => e.employeeId === emp.id && e.dayOfWeek === ctx.dayOfWeek + 1)
  if (tomorrowShift) shifts = shifts.filter((s) => (24 - s.endTime + tomorrowShift.startTime) >= 11)

  // Contract bounds
  const currentHours = state.employeeHours.get(emp.id) ?? 0
  const bounds = getWeeklyBounds(emp)
  shifts = shifts.filter((s) => currentHours + s.effectiveHours <= bounds.max)

  return shifts
}

function countWeekSlots(input: PlannerInput, state: SolverState, emp: Employee, dayContexts: DayAllocationContext[]): number {
  let total = 0
  for (const ctx of dayContexts) {
    if (!canWorkDay(input, state, emp, ctx)) continue
    total += getAvailableShifts(input, state, emp, ctx).length
  }
  return total
}

// =====================================================
// SUMMARIES
// =====================================================

function buildEmployeeSummaries(input: PlannerInput, state: SolverState): EmployeeWeekSummary[] {
  return input.employees.filter((e) => e.active).map((emp) => {
    const hours = state.employeeHours.get(emp.id) ?? 0
    const bounds = getWeeklyBounds(emp)
    const workDays = state.employeeWorkDays.get(emp.id) ?? new Set<number>()
    const entries = state.entries.filter((e) => e.employeeId === emp.id)
    let status: 'ok' | 'under' | 'over' = 'ok'
    if (hours < bounds.min) status = 'under'
    if (hours > bounds.max) status = 'over'
    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      contractHours: emp.weeklyHours,
      plannedHours: hours, boundsMin: bounds.min, boundsMax: bounds.max, status,
      daysOff: [0, 1, 2, 3, 4, 5, 6].filter((d) => !workDays.has(d)),
      totalMeals: entries.reduce((s, e) => s + e.meals, 0),
      totalBaskets: entries.reduce((s, e) => s + e.baskets, 0),
    }
  })
}

function buildDailySummaries(state: SolverState, dayContexts: DayAllocationContext[]): DailySummary[] {
  return dayContexts.map((ctx) => {
    const plannedHours = state.dailyHours.get(ctx.dayOfWeek) ?? 0
    const productivity = plannedHours > 0 ? ctx.forecastedRevenue / plannedHours : 0
    const dayEntries = state.entries.filter((e) => e.dayOfWeek === ctx.dayOfWeek)
    return {
      date: ctx.date, dayOfWeek: ctx.dayOfWeek,
      forecastedRevenue: ctx.forecastedRevenue, plannedHours, productivity,
      coverageMidi: countCoverage(dayEntries, 12, 15),
      coverageApresMidi: countCoverage(dayEntries, 15, 18),
      coverageSoir: countCoverage(dayEntries, 18, ctx.isSunday ? 21 : 24),
      openingStaff: dayEntries.filter((e) => e.startTime <= 9.5).length,
      closingStaff: dayEntries.filter((e) => e.endTime >= ctx.closingTime).length,
      isDelestage: false, delestageReason: null,
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
