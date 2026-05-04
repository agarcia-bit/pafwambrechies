import { useEffect, useState, useMemo, useRef } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useForecastStore } from '@/store/forecast-store'
import { useTenantStore } from '@/store/tenant-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrentPlanningStore } from '@/store/current-planning-store'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/ui/components'
import { PlanningGrid } from '@/ui/components/planning-grid'
import { generatePlanning } from '@/domain/engine'
import type { PlannerInput } from '@/domain/engine'
import type { PlanningReport, PlanningEntry } from '@/domain/models/planning'
import { validatePlanning } from '@/domain/rules/validation'
import { callSolver, checkSolverHealth } from '@/infrastructure/api/solver-api'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'
import type { Employee } from '@/domain/models/employee'
import type { Tenant } from '@/domain/models/tenant'
import { DEFAULT_TENANT_CONFIG } from '@/domain/models/tenant'
import {
  fetchUnavailabilities,
  createUnavailability,
  deleteUnavailability,
  fetchManagerSchedules,
  fetchConditionalAvailabilities,
} from '@/infrastructure/supabase/repositories/constraint-repo'
import { exportPlanningToExcel } from '@/infrastructure/export/excel-export'
import { savePlanningWithEntries, fetchPlanningEntries, fetchPlannings } from '@/infrastructure/supabase/repositories/planning-repo'
import type { EventOverride } from '@/domain/engine'
import { Calendar, Download, Play, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Plus, X, Save, CheckCircle } from 'lucide-react'

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function getNextMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getWeekNumber(d: Date): number {
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const week1 = new Date(target.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  )
}

export function PlanningPage({ loadPlanningId }: { loadPlanningId?: string | null }) {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { roles, employeeRoles, load: loadRoles } = useRoleStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const { forecasts, load: loadForecasts } = useForecastStore()
  const { tenant, load: loadTenant } = useTenantStore()
  const { tenantId, user } = useAuthStore()
  const { salleReport, salleWeekISO, setSalleReport } = useCurrentPlanningStore()

  const [weekStart, setWeekStart] = useState(() => {
    // Si un planning non sauvegardé existe pour une semaine précédente, on
    // restaure cette semaine pour que le rapport stocké soit cohérent.
    if (salleWeekISO) return new Date(salleWeekISO + 'T00:00:00')
    return getNextMonday()
  })
  const [report, setReportLocal] = useState<PlanningReport | null>(salleReport)
  // Wrapper qui sync le state local et le store global
  const setReport = (r: PlanningReport | null) => {
    setReportLocal(r)
    setSalleReport(r, formatISO(weekStart))
  }
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [solverAvailable, setSolverAvailable] = useState<boolean | null>(null)
  const [solverMode, setSolverMode] = useState<'cpsat' | 'local'>('cpsat')

  // Constraints loaded for display
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [conditionalAvailabilities, setConditionalAvailabilities] = useState<ConditionalAvailability[]>([])
  const [constraintsLoaded, setConstraintsLoaded] = useState(false)
  const [constraintsError, setConstraintsError] = useState<string>('')

  // CA adjustments per day (% override) and min staff
  const [dayAdjustments, setDayAdjustments] = useState<Record<number, { percent: number; minMidi: number; minSoir: number; minFermeture: number }>>({})

  function getDayAdjustment(day: number) {
    return dayAdjustments[day] ?? { percent: 0, minMidi: 0, minSoir: 0, minFermeture: 0 }
  }

  function setDayField(day: number, field: 'percent' | 'minMidi' | 'minSoir' | 'minFermeture', value: number) {
    setDayAdjustments((prev) => ({
      ...prev,
      [day]: { ...getDayAdjustment(day), [field]: value },
    }))
  }

  // Ajout contrainte ponctuelle inline
  const [addingConstraint, setAddingConstraint] = useState(false)
  const [newConstraintEmpId, setNewConstraintEmpId] = useState('')
  const [newConstraintDay, setNewConstraintDay] = useState(1)
  const [newConstraintType, setNewConstraintType] = useState<'off' | 'from' | 'until'>('off')
  const [newConstraintHour, setNewConstraintHour] = useState(14)

  function reloadConstraints() {
    setConstraintsLoaded(false)
    Promise.all([
      fetchUnavailabilities().catch(() => [] as Unavailability[]),
      fetchManagerSchedules().catch(() => [] as ManagerFixedSchedule[]),
      fetchConditionalAvailabilities().catch(() => [] as ConditionalAvailability[]),
    ]).then(([ua, ms, ca]) => {
      setUnavailabilities(ua)
      setManagerSchedules(ms)
      setConditionalAvailabilities(ca)
      setConstraintsLoaded(true)
    })
  }

  useEffect(() => {
    let cancelled = false
    loadEmployees()
    loadRoles()
    loadTemplates()
    loadForecasts()
    if (tenantId) loadTenant(tenantId)
    // Constraints: fetch with timeout to avoid silent hangs
    function withTimeout<T>(p: Promise<T>, label: string, ms = 10000): Promise<T> {
      return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timeout: ${label}`)), ms)),
      ])
    }
    Promise.allSettled([
      withTimeout(fetchUnavailabilities(), 'unavailabilities'),
      withTimeout(fetchManagerSchedules(), 'manager_schedules'),
      withTimeout(fetchConditionalAvailabilities(), 'conditional_availabilities'),
    ]).then((results) => {
      if (cancelled) return
      const [uaRes, msRes, caRes] = results
      setUnavailabilities(uaRes.status === 'fulfilled' ? uaRes.value : [])
      setManagerSchedules(msRes.status === 'fulfilled' ? msRes.value : [])
      setConditionalAvailabilities(caRes.status === 'fulfilled' ? caRes.value : [])
      setConstraintsLoaded(true)
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        setConstraintsError('Certaines contraintes n\'ont pas pu être chargées — le planning risque d\'être incomplet.')
      }
    })
    // Check solver availability — retry until ready or user gives up
    // eslint-disable-next-line prefer-const
    let retryTimer: ReturnType<typeof setInterval>
    function tryHealth() {
      checkSolverHealth().then((ok) => {
        if (cancelled) return
        setSolverAvailable(ok)
        if (ok) {
          setSolverMode('cpsat')
          clearInterval(retryTimer)
        }
      })
    }
    tryHealth()
    retryTimer = setInterval(tryHealth, 15000) // retry toutes les 15s
    return () => { cancelled = true; clearInterval(retryTimer) }
  }, [loadEmployees, loadRoles, loadTemplates, loadForecasts, loadTenant, tenantId])

  const activeEmployees = employees.filter((e) => e.active && e.department === 'salle')

  // Load a saved planning when coming from dashboard
  useEffect(() => {
    if (!loadPlanningId || activeEmployees.length === 0 || templates.length === 0) return

    Promise.all([
      fetchPlannings(),
      fetchPlanningEntries(loadPlanningId),
    ]).then(([plannings, entries]) => {
      const planning = plannings.find((p) => p.id === loadPlanningId)
      if (!planning || entries.length === 0) return

      // Set week to match the planning
      setWeekStart(new Date(planning.weekStartDate + 'T00:00:00'))

      // Build report from saved entries
      const empSummaries = buildSummaries(entries, activeEmployees)

      // Build daily summaries
      const dailySummaries = [1, 2, 3, 4, 5, 6].map((day) => {
        const dayEntries = entries.filter((e) => e.dayOfWeek === day)
        const isSunday = day === 6
        const closingTime = isSunday ? 21 : 24
        const plannedHours = dayEntries.reduce((s, e) => s + e.effectiveHours, 0)
        const month = new Date(planning.weekStartDate).getMonth() + 1
        const forecast = forecasts.find((f) => f.month === month && f.dayOfWeek === day)
        const revenue = forecast?.forecastedRevenue ?? 0
        const countCov = (from: number, to: number) => {
          let min = Infinity
          for (let h = from; h < to; h += 0.5) {
            const c = dayEntries.filter((e) => e.startTime <= h && e.endTime > h).length
            if (c < min) min = c
          }
          return min === Infinity ? 0 : min
        }
        return {
          date: addDays(planning.weekStartDate, day),
          dayOfWeek: day,
          forecastedRevenue: revenue,
          plannedHours,
          productivity: plannedHours > 0 ? revenue / plannedHours : 0,
          coverageMidi: countCov(12, 15),
          coverageApresMidi: countCov(15, 18),
          coverageSoir: countCov(18, closingTime),
          openingStaff: dayEntries.filter((e) => e.startTime <= 9.5).length,
          closingStaff: dayEntries.filter((e) => e.endTime >= closingTime).length,
          isDelestage: false,
          delestageReason: null,
        }
      })

      const violations = validatePlanning({
        entries,
        employees: activeEmployees,
        managerIds: activeEmployees.filter((e) => e.isManager).map((e) => e.id),
        shiftTemplates: templates,
        closingTimeWeek: 24,
        closingTimeSunday: 21,
      })

      setReport({
        planning: {
          id: planning.id,
          tenantId: planning.tenantId,
          weekStartDate: planning.weekStartDate,
          weekNumber: planning.weekNumber,
          status: planning.status as 'draft' | 'validated',
          generatedAt: planning.generatedAt,
          createdBy: planning.createdBy ?? '',
          entries,
        },
        employeeSummaries: empSummaries,
        dailySummaries,
        violations,
        warnings: [`Planning chargé (S${planning.weekNumber} — ${planning.status})`],
        isValid: violations.filter((v) => v.severity === 'blocking').length === 0,
      })
      setSaved(true)
    }).catch(() => {})
  }, [loadPlanningId, activeEmployees.length, templates.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
    setReport(null)
    setSaved(false)
    setDayAdjustments({})
    reloadConstraints()
  }

  const weekNumber = getWeekNumber(weekStart)
  const weekStartISO = formatISO(weekStart)

  // Build the week dates (Mon-Sun)
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i))
  }, [weekStartISO])

  // Build constraints summary for display
  const constraintsSummary = useMemo(() => {
    const items: { employeeName: string; type: 'fixed' | 'punctual' | 'conditional' | 'manager'; dayLabel: string; detail: string; id?: string }[] = []

    for (const emp of activeEmployees) {
      const empName = `${emp.firstName} ${emp.lastName}`.trim()

      // Collect manager OFF days to avoid duplicates with unavailabilities
      const managerOffDays = new Set<number>()
      if (emp.isManager) {
        for (const ms of managerSchedules.filter((s) => s.employeeId === emp.id)) {
          if (!ms.shiftTemplateId) {
            managerOffDays.add(ms.dayOfWeek)
            items.push({
              employeeName: empName,
              type: 'manager',
              dayLabel: DAY_NAMES[ms.dayOfWeek],
              detail: 'OFF (repos)',
            })
          }
        }
      }

      // Fixed unavailabilities (skip if already shown as manager OFF)
      for (const ua of unavailabilities.filter((u) => u.employeeId === emp.id && u.type === 'fixed')) {
        if (ua.dayOfWeek != null && !managerOffDays.has(ua.dayOfWeek)) {
          items.push({
            employeeName: empName,
            type: 'fixed',
            dayLabel: DAY_NAMES[ua.dayOfWeek],
            detail: ua.label || 'Indisponible',
          })
        }
      }

      // Punctual unavailabilities (only for this week)
      for (const ua of unavailabilities.filter((u) => u.employeeId === emp.id && u.type === 'punctual')) {
        if (ua.specificDate && weekDates.includes(ua.specificDate)) {
          const dayIndex = weekDates.indexOf(ua.specificDate)
          items.push({
            employeeName: empName,
            type: 'punctual',
            dayLabel: `${DAY_NAMES[dayIndex]} ${new Date(ua.specificDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`,
            detail: ua.label || 'OFF',
            id: ua.id,
          })
        }
      }
    }

    return items
  }, [activeEmployees, unavailabilities, managerSchedules, weekDates])

  const fixedConstraints = constraintsSummary.filter((c) => c.type === 'fixed' || c.type === 'manager')
  const punctualConstraints = constraintsSummary.filter((c) => c.type === 'punctual')

  // Readiness checks
  const checks = {
    employees: activeEmployees.length > 0,
    roles: roles.length > 0,
    templates: templates.length > 0,
    forecasts: forecasts.length > 0,
  }
  const allReady = Object.values(checks).every(Boolean)

  const generateRef = useRef<HTMLDivElement>(null)

  async function handleGenerate() {
    if (!tenantId) return
    setGenerating(true)
    setTimeout(() => generateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    setReport(null) // Hide previous planning during generation
    setSaved(false)
    setError('')

    let result: PlanningReport | null = null

    try {
      const tenantForEngine: Tenant = tenant ?? {
        id: tenantId,
        name: '',
        address: null,
        logoUrl: null,
        ...DEFAULT_TENANT_CONFIG,
        createdAt: '',
      }

      const input: PlannerInput = {
        tenant: tenantForEngine,
        weekStartDate: weekStartISO,
        employees: activeEmployees,
        roles,
        employeeRoles,
        shiftTemplates: templates,
        unavailabilities,
        conditionalAvailabilities,
        managerSchedules,
        dailyForecasts: forecasts,
        dailyRequirements: [],
        eventOverrides: Object.entries(dayAdjustments)
          .filter(([, adj]) => adj.percent !== 0)
          .map(([day, adj]): EventOverride => ({
            date: addDays(weekStartISO, Number(day)),
            revenueMultiplierPercent: adj.percent,
          })),
      }

      if (solverMode === 'cpsat' && solverAvailable) {
        // Use CP-SAT backend
        const solverReq = {
          week_start_date: weekStartISO,
          employees: activeEmployees.map((e) => ({
            id: e.id,
            first_name: e.firstName,
            weekly_hours: e.weeklyHours,
            modulation_range: e.modulationRange,
            is_manager: e.isManager,
            department: e.department,
            level: e.level,
            role_id: employeeRoles.find((er) => er.employeeId === e.id)?.roleId ?? '',
          })),
          shift_templates: templates.map((t) => ({
            id: t.id,
            code: t.code,
            start_time: t.startTime,
            end_time: t.endTime,
            effective_hours: t.effectiveHours,
            meals: t.meals,
            baskets: t.baskets,
            applicability: t.applicability,
            department: t.department,
          })),
          manager_schedules: managerSchedules.map((ms) => ({
            employee_id: ms.employeeId,
            day_of_week: ms.dayOfWeek,
            shift_template_id: ms.shiftTemplateId,
            start_time: ms.startTime,
            end_time: ms.endTime,
          })),
          unavailabilities: unavailabilities.map((u) => ({
            employee_id: u.employeeId,
            type: u.type,
            day_of_week: u.dayOfWeek,
            specific_date: u.specificDate,
            available_from: u.availableFrom,
            available_until: u.availableUntil,
          })),
          conditional_availabilities: conditionalAvailabilities.map((ca) => ({
            employee_id: ca.employeeId,
            day_of_week: ca.dayOfWeek,
            allowed_shift_codes: ca.allowedShiftCodes,
            max_hours: ca.maxHours,
          })),
          day_forecasts: forecasts
            .filter((f) => f.month === new Date(weekStartISO).getMonth() + 1)
            .map((f) => ({ day_of_week: f.dayOfWeek, forecasted_revenue: f.forecastedRevenue })),
          event_overrides: Object.entries(dayAdjustments)
            .filter(([, adj]) => adj.percent !== 0)
            .map(([day, adj]) => ({ day_of_week: Number(day), revenue_multiplier_percent: adj.percent })),
          employee_roles: Object.fromEntries(
            employeeRoles.map((er) => [er.employeeId, er.roleId]),
          ),
          closing_time_week: tenant?.closingTimeWeek ?? 24.0,
          closing_time_sunday: tenant?.closingTimeSunday ?? 21.0,
          productivity_target: tenant?.productivityTarget ?? 95,
          min_staff_midi: Object.fromEntries(
            Object.entries(dayAdjustments).filter(([, a]) => a.minMidi > 0).map(([d, a]) => [d, a.minMidi]),
          ),
          min_staff_soir: Object.fromEntries(
            Object.entries(dayAdjustments).filter(([, a]) => a.minSoir > 0).map(([d, a]) => [d, a.minSoir]),
          ),
          min_staff_fermeture: Object.fromEntries(
            Object.entries(dayAdjustments).filter(([, a]) => a.minFermeture > 0).map(([d, a]) => [d, a.minFermeture]),
          ),
          // --- Règles tenant ---
          min_rest_hours: tenant?.rules.minRestHours ?? 11,
          max_working_days: tenant?.rules.maxWorkingDays ?? 5,
          fulltime_threshold: tenant?.rules.fulltimeThreshold ?? 35,
          min_closing_weekday: tenant?.rules.minClosingWeekday ?? 4,
          min_closing_weekend: tenant?.rules.minClosingWeekend ?? 6,
          weekend_start_day: tenant?.rules.weekendStartDay ?? 3,
        }

        const solverResult = await callSolver(solverReq)

        if (!solverResult.success) {
          setError(`Solveur CP-SAT : ${solverResult.warnings.join(', ')}`)
          setGenerating(false)
          return
        }

        // Convert solver response to PlanningReport
        const planningId = crypto.randomUUID()
        const weekNumber = getWeekNumber(weekStart)
        const entries: PlanningEntry[] = solverResult.entries.map((e) => ({
          id: crypto.randomUUID(),
          planningId,
          employeeId: e.employee_id,
          roleId: employeeRoles.find((er) => er.employeeId === e.employee_id)?.roleId ?? '',
          date: addDays(weekStartISO, e.day_of_week),
          dayOfWeek: e.day_of_week,
          shiftTemplateId: e.shift_template_id,
          startTime: e.start_time,
          endTime: e.end_time,
          effectiveHours: e.effective_hours,
          meals: e.meals,
          baskets: e.baskets,
        }))

        const violations = validatePlanning({
          entries,
          employees: activeEmployees,
          managerIds: activeEmployees.filter((e) => e.isManager).map((e) => e.id),
          shiftTemplates: templates,
          closingTimeWeek: 24,
          closingTimeSunday: 21,
        })

        const warnings = [...solverResult.warnings]
        warnings.unshift(`Résolu par CP-SAT en ${solverResult.solve_time_ms}ms (${solverResult.status})`)

        result = {
          planning: {
            id: planningId,
            tenantId: tenantId ?? '',
            weekStartDate: weekStartISO,
            weekNumber,
            status: 'draft',
            generatedAt: new Date().toISOString(),
            createdBy: '',
            entries,
          },
          employeeSummaries: buildSummaries(entries, activeEmployees),
          dailySummaries: buildDaySummaries(entries, input),
          violations,
          warnings,
          isValid: violations.filter((v) => v.severity === 'blocking').length === 0,
        }
      } else {
        // Fallback: local TS algorithm
        result = generatePlanning(input)
      }
    } catch (e) {
      setError((e as Error).message)
    }

    // Minimum 3s loading for premium UX
    await new Promise((r) => setTimeout(r, 3000))
    if (result) setReport(result)
    setGenerating(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Génération de Planning</h1>
      </div>

      {/* Sélecteur de semaine */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <button
            onClick={() => shiftWeek(-1)}
            className="rounded p-2 hover:bg-muted"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-primary" />
            <div className="text-center">
              <div className="text-lg font-bold">Semaine {weekNumber}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {' — '}
                {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
          <button
            onClick={() => shiftWeek(1)}
            className="rounded p-2 hover:bg-muted"
          >
            <ChevronRight size={20} />
          </button>
        </CardContent>
      </Card>


      {/* Rappel des contraintes — trié par jour en colonnes */}
      {constraintsLoaded && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Contraintes de la semaine
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddingConstraint(!addingConstraint)}
              >
                <Plus size={14} className="mr-1" /> Contrainte ponctuelle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Formulaire ajout inline */}
            {addingConstraint && (
              <div className="mb-4 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Salarié</label>
                    <select
                      value={newConstraintEmpId}
                      onChange={(e) => setNewConstraintEmpId(e.target.value)}
                      className="h-8 rounded border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— Choisir —</option>
                      {activeEmployees.map((e) => (
                        <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Jour</label>
                    <select
                      value={newConstraintDay}
                      onChange={(e) => setNewConstraintDay(Number(e.target.value))}
                      className="h-8 rounded border border-input bg-background px-2 text-sm"
                    >
                      {DAY_NAMES.slice(1).map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name} {weekDates[i + 1] ? new Date(weekDates[i + 1]).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Type</label>
                    <select
                      value={newConstraintType}
                      onChange={(e) => setNewConstraintType(e.target.value as 'off' | 'from' | 'until')}
                      className="h-8 rounded border border-input bg-background px-2 text-sm"
                    >
                      <option value="off">OFF complet</option>
                      <option value="from">Dispo à partir de...</option>
                      <option value="until">Doit partir avant...</option>
                    </select>
                  </div>
                  {newConstraintType !== 'off' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium">
                        {newConstraintType === 'from' ? 'À partir de' : 'Avant'}
                      </label>
                      <select
                        value={newConstraintHour}
                        onChange={(e) => setNewConstraintHour(Number(e.target.value))}
                        className="h-8 rounded border border-input bg-background px-2 text-sm"
                      >
                        {[9.5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((h) => (
                          <option key={h} value={h}>{h === 9.5 ? '9h30' : `${h}h`}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!newConstraintEmpId}
                    onClick={async () => {
                      if (!newConstraintEmpId) return
                      const date = weekDates[newConstraintDay]
                      if (!date) return
                      let label = 'OFF'
                      let availableFrom: number | null = null
                      let availableUntil: number | null = null

                      if (newConstraintType === 'from') {
                        availableFrom = newConstraintHour
                        label = `Dispo à partir de ${newConstraintHour}h`
                      } else if (newConstraintType === 'until') {
                        availableUntil = newConstraintHour
                        label = `Doit partir avant ${newConstraintHour}h`
                      }

                      await createUnavailability({
                        employeeId: newConstraintEmpId,
                        type: 'punctual',
                        dayOfWeek: null,
                        specificDate: date,
                        availableFrom,
                        availableUntil,
                        label,
                      })
                      reloadConstraints()
                      setAddingConstraint(false)
                      setNewConstraintEmpId('')
                      setNewConstraintType('off')
                    }}
                  >
                    Ajouter
                  </Button>
                  <button onClick={() => setAddingConstraint(false)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-warning/60"></span> Récurrent (chaque semaine)</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-destructive/60"></span> Ponctuel (cette semaine)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border">
                    {DAY_NAMES.slice(1).map((name, i) => (
                      <th key={i + 1} className="w-1/6 px-2 py-2 text-center font-medium text-muted-foreground">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {DAY_NAMES.slice(1).map((_, i) => {
                      const dayIndex = i + 1
                      const dayFixed = fixedConstraints.filter((c) => c.dayLabel === DAY_NAMES[dayIndex])
                      const dayPunctual = punctualConstraints.filter((c) => c.dayLabel.startsWith(DAY_NAMES[dayIndex]))
                      const items = [...dayFixed, ...dayPunctual]
                      return (
                        <td key={dayIndex} className="px-2 py-2 align-top">
                          {items.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {items.map((c, ci) => (
                                <div
                                  key={ci}
                                  className={`group relative rounded px-2 py-1 text-xs ${
                                    c.type === 'punctual'
                                      ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                                      : 'bg-warning/10 text-warning'
                                  }`}
                                >
                                  <span className="font-medium">{c.employeeName}</span>
                                  <br />
                                  <span className="opacity-80">{c.detail}</span>
                                  {c.type === 'punctual' && c.id && (
                                    <button
                                      onClick={async () => {
                                        await deleteUnavailability(c.id!)
                                        reloadConstraints()
                                      }}
                                      className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-white group-hover:block"
                                      title="Supprimer"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {punctualConstraints.length === 0 && !addingConstraint && (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune contrainte ponctuelle pour cette semaine.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* CA Prévisionnel + Ajustements + Min staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={18} />
            CA prévisionnel & ajustements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const weekMonth = new Date(weekStartISO).getMonth() + 1
            const totalCA = DAY_NAMES.slice(1).reduce((sum, _, i) => {
              const day = i + 1
              const base = forecasts.find((f) => f.month === weekMonth && f.dayOfWeek === day)?.forecastedRevenue ?? 0
              const adj = getDayAdjustment(day).percent
              return sum + base * (1 + adj / 100)
            }, 0)
            const totalBaseHours = activeEmployees.reduce((sum, e) => sum + e.weeklyHours, 0)
            const totalMaxHours = activeEmployees.reduce((sum, e) => sum + e.weeklyHours + e.modulationRange, 0)
            const weekProductivity = totalBaseHours > 0 ? totalCA / totalBaseHours : 0
            // 3 levels: <85 = overstaffed, 85-110 = good, >110 = understaffed
            const level = weekProductivity < 85 ? 'overstaffed' : weekProductivity > 110 ? 'understaffed' : 'good'

            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground"></th>
                        {DAY_NAMES.slice(1).map((name, i) => (
                          <th key={i + 1} className="px-2 py-2 text-center font-medium text-muted-foreground">{name}</th>
                        ))}
                        <th className="px-2 py-2 text-center font-bold">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">CA base</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          const base = forecasts.find((f) => f.month === weekMonth && f.dayOfWeek === day)?.forecastedRevenue ?? 0
                          return <td key={day} className="px-2 py-2 text-center text-muted-foreground">{base > 0 ? `${Math.round(base)}€` : '—'}</td>
                        })}
                        {(() => {
                          const baseTotal = DAY_NAMES.slice(1).reduce((sum, _, i) => {
                            const day = i + 1
                            return sum + (forecasts.find((f) => f.month === weekMonth && f.dayOfWeek === day)?.forecastedRevenue ?? 0)
                          }, 0)
                          return <td className="px-2 py-2 text-center font-bold text-muted-foreground">{Math.round(baseTotal).toLocaleString('fr-FR')}€</td>
                        })()}
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Ajustement %</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          const adj = getDayAdjustment(day).percent
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <select
                                value={adj}
                                onChange={(e) => setDayField(day, 'percent', Number(e.target.value))}
                                className={`w-16 h-7 rounded border text-center text-xs ${adj !== 0 ? 'border-warning bg-warning/10 font-bold' : 'border-input bg-background'}`}
                              >
                                {[-100, -75, -50, -30, -20, -10, 0, 10, 20, 30, 40, 50, 75, 100].map((v) => (
                                  <option key={v} value={v}>{v > 0 ? `+${v}%` : v === 0 ? '—' : `${v}%`}</option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                      <tr className="border-b border-border bg-muted/30">
                        <td className="px-2 py-2 text-sm font-bold">CA ajusté</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          const base = forecasts.find((f) => f.month === weekMonth && f.dayOfWeek === day)?.forecastedRevenue ?? 0
                          const adj = getDayAdjustment(day).percent
                          const adjusted = Math.round(base * (1 + adj / 100))
                          return (
                            <td key={day} className={`px-2 py-2 text-center font-bold ${adj !== 0 ? 'text-warning' : ''}`}>
                              {adjusted > 0 ? `${adjusted}€` : '—'}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center font-bold text-primary">{Math.round(totalCA).toLocaleString('fr-FR')}€</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Mini service midi</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <select
                                value={getDayAdjustment(day).minMidi}
                                onChange={(e) => setDayField(day, 'minMidi', Number(e.target.value))}
                                className="w-12 h-7 rounded border border-input bg-background text-center text-xs"
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((v) => (
                                  <option key={v} value={v}>{v === 0 ? '—' : v}</option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Mini service soir</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <select
                                value={getDayAdjustment(day).minSoir}
                                onChange={(e) => setDayField(day, 'minSoir', Number(e.target.value))}
                                className="w-12 h-7 rounded border border-input bg-background text-center text-xs"
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((v) => (
                                  <option key={v} value={v}>{v === 0 ? '—' : v}</option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Mini fermeture</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <select
                                value={getDayAdjustment(day).minFermeture}
                                onChange={(e) => setDayField(day, 'minFermeture', Number(e.target.value))}
                                className="w-12 h-7 rounded border border-input bg-background text-center text-xs"
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((v) => (
                                  <option key={v} value={v}>{v === 0 ? '—' : v}</option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Indicateur productivité semaine */}
                <div className={`mt-4 flex items-center justify-between rounded-lg p-4 ${
                  level === 'understaffed' ? 'bg-destructive/10 border border-destructive/30' :
                  level === 'overstaffed' ? 'bg-warning/10 border border-warning/30' :
                  'bg-success/10 border border-success/30'
                }`}>
                  <div>
                    <p className="text-sm font-bold">Productivité semaine estimée</p>
                    <p className="text-xs text-muted-foreground">
                      CA total : {Math.round(totalCA).toLocaleString('fr-FR')}€ / Heures contrat : {totalBaseHours}h (max {totalMaxHours}h)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      level === 'understaffed' ? 'text-destructive' :
                      level === 'overstaffed' ? 'text-warning' : 'text-success'
                    }`}>
                      {Math.round(weekProductivity)}
                    </p>
                    <p className={`text-xs font-medium ${
                      level === 'understaffed' ? 'text-destructive' :
                      level === 'overstaffed' ? 'text-warning' : 'text-success'
                    }`}>
                      {level === 'understaffed' ? 'Envisager un renfort' :
                       level === 'overstaffed' ? 'Délester des heures' :
                       'Effectif suffisant'}
                    </p>
                  </div>
                </div>
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Alertes pré-génération */}
      {constraintsError && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{constraintsError}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90"
          >
            Recharger
          </button>
        </div>
      )}
      {constraintsLoaded && activeEmployees.some((e) => e.isManager) && managerSchedules.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm text-warning">
          <AlertTriangle size={16} />
          <span>Les horaires fixes des managers n'ont pas été chargés. Le planning sera généré sans eux (0h). Rechargez la page avant de générer.</span>
        </div>
      )}

      {/* Indicateur solveur */}
      <div className="flex items-center justify-center gap-2 text-xs">
        {solverAvailable === null && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Connexion en cours à l'algorithme Planning, patientez quelques secondes...
          </span>
        )}
        {solverAvailable === true && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connecté à l'algorithme, vous pouvez lancer la génération
          </span>
        )}
        {solverAvailable === false && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Algorythme indisponible, réessayer plus tard
          </span>
        )}
      </div>

      {/* Bouton générer + enregistrer + exporter */}
      <div ref={generateRef} className="flex items-center justify-center gap-3">
        <Button
          size="lg"
          className="px-12"
          onClick={handleGenerate}
          disabled={!allReady || generating}
        >
          <Play size={18} className="mr-2" />
          {generating ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Optimisation en cours...
            </>
          ) : 'Générer le planning'}
        </Button>

        {report && !saved && (
          <Button
            size="lg"
            variant="outline"
            onClick={async () => {
              if (!tenantId) return
              await savePlanningWithEntries({
                id: report.planning.id,
                tenantId,
                weekStartDate: report.planning.weekStartDate,
                weekNumber: report.planning.weekNumber,
                status: 'draft',
                createdBy: user?.id ?? '',
              }, report.planning.entries)
              setSaved(true)
            }}
          >
            <Save size={16} className="mr-2" /> Enregistrer
          </Button>
        )}
        {report && saved && (
          <span className="flex items-center gap-1 rounded-md bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
            <CheckCircle size={16} /> Enregistré
          </span>
        )}
        {report && (
          <Button size="lg" variant="secondary" onClick={() => exportPlanningToExcel(report)}>
            <Download size={16} className="mr-2" /> Exporter Excel
          </Button>
        )}
      </div>

      {/* Loading overlay */}
      {generating && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 py-16">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar size={20} className="text-primary animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-primary">Optimisation en cours</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyse des contraintes et calcul du planning optimal...
            </p>
          </div>
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Résultat */}
      {report && (
        <PlanningGrid
          report={report}
          shiftTemplates={templates}
          employees={activeEmployees}
          onShiftChange={(employeeId, dayOfWeek, newShiftId) => {
            if (!report || !tenantId) return
            const entries = [...report.planning.entries]

            // Remove existing entry for this employee+day
            const idx = entries.findIndex(
              (e) => e.employeeId === employeeId && e.dayOfWeek === dayOfWeek,
            )
            if (idx !== -1) entries.splice(idx, 1)

            if (newShiftId) {
              const template = templates.find((t) => t.id === newShiftId)
              if (template) {
                entries.push({
                  id: crypto.randomUUID(),
                  planningId: report.planning.id,
                  employeeId,
                  roleId: employeeRoles.find((er) => er.employeeId === employeeId)?.roleId ?? '',
                  date: addDays(formatISO(weekStart), dayOfWeek),
                  dayOfWeek,
                  shiftTemplateId: template.id,
                  startTime: template.startTime,
                  endTime: template.endTime,
                  effectiveHours: template.effectiveHours,
                  meals: template.meals,
                  baskets: template.baskets,
                })
              }
            }

            // Recalculate employee summaries
            const empSummaries = report.employeeSummaries.map((s) => {
              const empEntries = entries.filter((e) => e.employeeId === s.employeeId)
              const plannedHours = empEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
              return {
                ...s,
                plannedHours,
                status: plannedHours < s.boundsMin ? 'under' as const : plannedHours > s.boundsMax ? 'over' as const : 'ok' as const,
                totalMeals: empEntries.reduce((sum, e) => sum + e.meals, 0),
                totalBaskets: empEntries.reduce((sum, e) => sum + e.baskets, 0),
                daysOff: [0, 1, 2, 3, 4, 5, 6].filter((d) => !empEntries.some((e) => e.dayOfWeek === d)),
              }
            })

            // Recalculate daily summaries
            const dailySummaries = report.dailySummaries.map((ds) => {
              const dayEntries = entries.filter((e) => e.dayOfWeek === ds.dayOfWeek)
              const plannedHours = dayEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
              const productivity = plannedHours > 0 ? ds.forecastedRevenue / plannedHours : 0
              const countCov = (from: number, to: number) => {
                let min = Infinity
                for (let h = from; h < to; h += 0.5) {
                  const c = dayEntries.filter((e) => e.startTime <= h && e.endTime > h).length
                  if (c < min) min = c
                }
                return min === Infinity ? 0 : min
              }
              const closingTime = ds.dayOfWeek === 6 ? 21 : 24
              return {
                ...ds,
                plannedHours,
                productivity,
                openingStaff: dayEntries.filter((e) => e.startTime <= 9.5).length,
                coverageMidi: countCov(12, 15),
                coverageApresMidi: countCov(15, 18),
                coverageSoir: countCov(18, closingTime),
                closingStaff: dayEntries.filter((e) => e.endTime >= closingTime).length,
              }
            })

            // Revalidate
            const violations = validatePlanning({
              entries,
              employees: activeEmployees,
              managerIds: activeEmployees.filter((e) => e.isManager).map((e) => e.id),
              shiftTemplates: templates,
              closingTimeWeek: 24,
              closingTimeSunday: 21,
            })

            setReport({
              ...report,
              planning: { ...report.planning, entries },
              employeeSummaries: empSummaries,
              dailySummaries,
              violations,
              isValid: violations.filter((v) => v.severity === 'blocking').length === 0,
            })
            setSaved(false)
          }}
        />
      )}
    </div>
  )
}

// Helper: build employee summaries from entries
function buildSummaries(entries: PlanningEntry[], employees: Employee[]): import('@/domain/models/planning').EmployeeWeekSummary[] {
  return employees.filter((e) => e.active).map((emp) => {
    const empEntries = entries.filter((e) => e.employeeId === emp.id)
    const hours = empEntries.reduce((s, e) => s + e.effectiveHours, 0)
    const min = emp.weeklyHours - emp.modulationRange
    const max = emp.weeklyHours + emp.modulationRange
    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      contractHours: emp.weeklyHours,
      plannedHours: hours,
      boundsMin: min,
      boundsMax: max,
      status: hours < min ? 'under' as const : hours > max ? 'over' as const : 'ok' as const,
      daysOff: [0, 1, 2, 3, 4, 5, 6].filter((d) => !empEntries.some((e) => e.dayOfWeek === d)),
      totalMeals: empEntries.reduce((s, e) => s + e.meals, 0),
      totalBaskets: empEntries.reduce((s, e) => s + e.baskets, 0),
    }
  })
}

// Helper: build daily summaries from entries
function buildDaySummaries(entries: PlanningEntry[], input: PlannerInput): import('@/domain/models/planning').DailySummary[] {
  return [1, 2, 3, 4, 5, 6].map((day) => {
    const dayEntries = entries.filter((e) => e.dayOfWeek === day)
    const isSunday = day === 6
    const closingTime = isSunday ? 21 : 24
    const plannedHours = dayEntries.reduce((s, e) => s + e.effectiveHours, 0)
    const month = new Date(input.weekStartDate).getMonth() + 1
    const forecast = input.dailyForecasts.find((f) => f.month === month && f.dayOfWeek === day)
    let revenue = forecast?.forecastedRevenue ?? 0
    const override = input.eventOverrides?.find((e) => e.date === addDays(input.weekStartDate, day))
    if (override) revenue *= 1 + override.revenueMultiplierPercent / 100

    const countCov = (from: number, to: number) => {
      let min = Infinity
      for (let h = from; h < to; h += 0.5) {
        const c = dayEntries.filter((e) => e.startTime <= h && e.endTime > h).length
        if (c < min) min = c
      }
      return min === Infinity ? 0 : min
    }

    return {
      date: addDays(input.weekStartDate, day),
      dayOfWeek: day,
      forecastedRevenue: revenue,
      plannedHours,
      productivity: plannedHours > 0 ? revenue / plannedHours : 0,
      coverageMidi: countCov(12, 15),
      coverageApresMidi: countCov(15, 18),
      coverageSoir: countCov(18, closingTime),
      openingStaff: dayEntries.filter((e) => e.startTime <= 9.5).length,
      closingStaff: dayEntries.filter((e) => e.endTime >= closingTime).length,
      isDelestage: false,
      delestageReason: null,
    }
  })
}

