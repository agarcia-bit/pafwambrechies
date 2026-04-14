import { useEffect, useState } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useForecastStore } from '@/store/forecast-store'
import { useTenantStore } from '@/store/tenant-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Card, CardContent } from '@/ui/components'
import { callKitchenSolver } from '@/infrastructure/api/solver-api'
import {
  createUnavailability,
  deleteUnavailability,
} from '@/infrastructure/supabase/repositories/constraint-repo'
import type { SolverShiftAssignment } from '@/infrastructure/api/solver-api'
import { fetchUnavailabilities } from '@/infrastructure/supabase/repositories/constraint-repo'
import type { Unavailability } from '@/domain/models/constraint'
import { getWeeklyBounds } from '@/domain/models/employee'
import { Calendar, Play, ChevronLeft, ChevronRight, Plus, X, Save, CheckCircle } from 'lucide-react'
import { savePlanningWithEntries } from '@/infrastructure/supabase/repositories/planning-repo'
import type { PlanningEntry } from '@/domain/models/planning'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getNextMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getWeekNumber(d: Date): number {
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const week1 = new Date(target.getFullYear(), 0, 4)
  return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

interface KitchenEntry {
  employeeId: string
  dayOfWeek: number
  shiftTemplateId: string
  startTime: number
  endTime: number
  effectiveHours: number
  period: 'midi' | 'soir'
}

export function KitchenPlanningPage({ loadPlanningId }: { loadPlanningId?: string | null }) {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const { forecasts, load: loadForecasts } = useForecastStore()
  const { tenant, load: loadTenant } = useTenantStore()
  const { tenantId, user } = useAuthStore()

  const [weekStart, setWeekStart] = useState(getNextMonday())
  const [entries, setEntries] = useState<KitchenEntry[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [solverInfo, setSolverInfo] = useState('')
  const [saved, setSaved] = useState(false)
  const [editingCell, setEditingCell] = useState<{ empId: string; day: number } | null>(null)
  const [planningId] = useState(crypto.randomUUID())
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [addingConstraint, setAddingConstraint] = useState(false)
  const [newConstraintEmpId, setNewConstraintEmpId] = useState('')
  const [newConstraintDay, setNewConstraintDay] = useState(1)

  useEffect(() => {
    loadEmployees()
    loadTemplates()
    loadForecasts()
    if (tenantId) loadTenant(tenantId)
    fetchUnavailabilities().then(setUnavailabilities).catch(() => {})
  }, [loadEmployees, loadTemplates, loadForecasts, loadTenant, tenantId])

  const kitchenEmployees = employees.filter((e) => e.active && e.department === 'cuisine')
  const weekNumber = getWeekNumber(weekStart)
  const weekStartISO = formatISO(weekStart)

  // Load saved kitchen planning from dashboard
  useEffect(() => {
    if (!loadPlanningId || kitchenEmployees.length === 0) return
    import('@/infrastructure/supabase/repositories/planning-repo').then(({ fetchPlannings, fetchPlanningEntries }) => {
      Promise.all([fetchPlannings(), fetchPlanningEntries(loadPlanningId)]).then(([plannings, dbEntries]) => {
        const planning = plannings.find((p) => p.id === loadPlanningId)
        if (!planning || dbEntries.length === 0) return
        setWeekStart(new Date(planning.weekStartDate + 'T00:00:00'))
        const mapped: KitchenEntry[] = dbEntries.map((e) => ({
          employeeId: e.employeeId,
          dayOfWeek: e.dayOfWeek,
          shiftTemplateId: e.shiftTemplateId,
          startTime: e.startTime,
          endTime: e.endTime,
          effectiveHours: e.effectiveHours,
          period: e.startTime < 16 ? 'midi' as const : 'soir' as const,
        }))
        setEntries(mapped)
        setSaved(true)
        setSolverInfo(`Planning chargé (S${planning.weekNumber} — ${planning.status})`)
      }).catch(() => {})
    })
  }, [loadPlanningId, kitchenEmployees.length])

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
    setEntries([])
    setSaved(false)
    setSolverInfo('')
  }

  async function handleGenerate() {
    if (!tenantId) return
    setGenerating(true)
    setEntries([])
    setSaved(false)
    setError('')
    setSolverInfo('')

    try {
      const solverReq = {
        week_start_date: weekStartISO,
        employees: kitchenEmployees.map((e) => ({
          id: e.id,
          first_name: e.firstName,
          weekly_hours: e.weeklyHours,
          modulation_range: e.modulationRange,
          is_manager: false,
          department: 'cuisine',
          role_id: '',
        })),
        shift_templates: templates.filter((t) => t.department === 'cuisine').map((t) => ({
          id: t.id,
          code: t.code,
          start_time: t.startTime,
          end_time: t.endTime,
          effective_hours: t.effectiveHours,
          meals: t.meals,
          baskets: t.baskets,
          applicability: t.applicability,
          department: 'cuisine',
        })),
        unavailabilities: unavailabilities
          .filter((u) => kitchenEmployees.some((e) => e.id === u.employeeId))
          .map((u) => ({
            employee_id: u.employeeId,
            type: u.type,
            day_of_week: u.dayOfWeek,
            specific_date: u.specificDate,
            available_from: u.availableFrom,
            available_until: u.availableUntil,
          })),
        manager_schedules: [],
        conditional_availabilities: [],
        day_forecasts: forecasts
          .filter((f) => f.month === new Date(weekStartISO).getMonth() + 1)
          .map((f) => ({ day_of_week: f.dayOfWeek, forecasted_revenue: f.forecastedRevenue })),
        event_overrides: [],
        employee_roles: {},
        closing_time_week: tenant?.closingTimeWeek ?? 24,
        closing_time_sunday: tenant?.closingTimeSunday ?? 21,
        productivity_target: tenant?.productivityTarget ?? 95,
        // --- Règles tenant ---
        min_rest_hours: tenant?.rules.minRestHours ?? 11,
        max_working_days: tenant?.rules.maxWorkingDays ?? 5,
        fulltime_threshold: tenant?.rules.fulltimeThreshold ?? 35,
        min_kitchen_midi: tenant?.rules.minKitchenMidi ?? 2,
        kitchen_prep_day: tenant?.rules.kitchenPrepDay ?? null,
        kitchen_prep_team: tenant?.rules.kitchenPrepTeam ?? [],
        kitchen_closed_sunday_evening: tenant?.rules.kitchenClosedSundayEvening ?? true,
      }

      const result = await callKitchenSolver(solverReq)

      if (!result.success) {
        setError(`Cuisine: ${result.warnings.join(', ')}`)
      } else {
        const mapped: KitchenEntry[] = result.entries.map((e: SolverShiftAssignment) => ({
          employeeId: e.employee_id,
          dayOfWeek: e.day_of_week,
          shiftTemplateId: e.shift_template_id,
          startTime: e.start_time,
          endTime: e.end_time,
          effectiveHours: e.effective_hours,
          period: e.start_time < 16 ? 'midi' as const : 'soir' as const,
        }))
        setEntries(mapped)
        setSolverInfo(`Résolu par CP-SAT en ${result.solve_time_ms}ms (${result.status})`)
      }
    } catch (e) {
      setError((e as Error).message)
    }

    await new Promise((r) => setTimeout(r, 2000))
    setGenerating(false)
  }

  // Calculate totals per employee
  const empTotals = kitchenEmployees.map((emp) => {
    const empEntries = entries.filter((e) => e.employeeId === emp.id)
    const totalHours = empEntries.reduce((s, e) => s + e.effectiveHours, 0)
    const bounds = getWeeklyBounds(emp)
    return { emp, empEntries, totalHours, bounds }
  })

  // Shifts cuisine disponibles pour un jour donné, filtré par période
  function getKitchenShiftsForDay(day: number, period: 'midi' | 'soir') {
    const isSunday = day === 6
    return templates
      .filter((t) => t.department === 'cuisine')
      .filter((t) => {
        if (isSunday) return t.applicability === 'sunday'
        return t.applicability === 'tue_sat' || t.applicability === 'sat_only'
      })
      .filter((t) => (period === 'midi' ? t.startTime < 16 : t.startTime >= 17))
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)
  }

  // Change le shift midi ou soir pour (emp, day) — null = supprimer
  function handleShiftChange(
    empId: string,
    day: number,
    period: 'midi' | 'soir',
    shiftId: string | null,
  ) {
    setEntries((prev) => {
      // Retire l'entrée existante pour ce couple (emp, day, period)
      const filtered = prev.filter(
        (e) => !(e.employeeId === empId && e.dayOfWeek === day && e.period === period),
      )
      if (!shiftId) return filtered
      const shift = templates.find((t) => t.id === shiftId)
      if (!shift) return filtered
      return [
        ...filtered,
        {
          employeeId: empId,
          dayOfWeek: day,
          shiftTemplateId: shift.id,
          startTime: shift.startTime,
          endTime: shift.endTime,
          effectiveHours: shift.effectiveHours,
          period,
        },
      ]
    })
    setSaved(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Planning Cuisine</h1>

      {/* Sélecteur de semaine */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <button onClick={() => shiftWeek(-1)} className="rounded p-2 hover:bg-muted">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-primary" />
            <div className="text-center">
              <div className="text-lg font-bold">Semaine {weekNumber}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {' — '}
                {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          <button onClick={() => shiftWeek(1)} className="rounded p-2 hover:bg-muted">
            <ChevronRight size={20} />
          </button>
        </CardContent>
      </Card>

      {/* Contraintes cuisine */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Contraintes cuisine de la semaine</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingConstraint(!addingConstraint)}
            >
              <Plus size={14} className="mr-1" /> Contrainte ponctuelle
            </Button>
          </div>

          {addingConstraint && (
            <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Cuisinier</label>
                <select
                  value={newConstraintEmpId}
                  onChange={(e) => setNewConstraintEmpId(e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">— Choisir —</option>
                  {kitchenEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName}</option>
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
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={!newConstraintEmpId}
                onClick={async () => {
                  if (!newConstraintEmpId) return
                  const date = addDays(weekStartISO, newConstraintDay)
                  await createUnavailability({
                    employeeId: newConstraintEmpId,
                    type: 'punctual',
                    dayOfWeek: null,
                    specificDate: date,
                    availableFrom: null,
                    availableUntil: null,
                    label: 'OFF',
                  })
                  fetchUnavailabilities().then(setUnavailabilities).catch(() => {})
                  setAddingConstraint(false)
                  setNewConstraintEmpId('')
                }}
              >
                Ajouter OFF
              </Button>
              <button onClick={() => setAddingConstraint(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Display current constraints */}
          <div className="flex flex-wrap gap-2">
            {unavailabilities
              .filter((u) => kitchenEmployees.some((e) => e.id === u.employeeId))
              .map((u) => {
                const emp = kitchenEmployees.find((e) => e.id === u.employeeId)
                return (
                  <span key={u.id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${u.type === 'fixed' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                    {emp?.firstName} — {u.type === 'fixed' && u.dayOfWeek != null ? DAY_NAMES[u.dayOfWeek] : u.label}
                    {u.type === 'punctual' && (
                      <button
                        onClick={async () => {
                          await deleteUnavailability(u.id)
                          fetchUnavailabilities().then(setUnavailabilities).catch(() => {})
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Bouton générer */}
      <div className="flex items-center justify-center gap-3">
        <Button
          size="lg"
          className="px-12"
          onClick={handleGenerate}
          disabled={kitchenEmployees.length === 0 || generating}
        >
          {generating ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Optimisation cuisine...
            </>
          ) : (
            <>
              <Play size={18} className="mr-2" /> Générer planning cuisine
            </>
          )}
        </Button>

        {entries.length > 0 && !saved && (
          <Button
            size="lg"
            variant="outline"
            onClick={async () => {
              if (!tenantId) return
              const planningEntries: PlanningEntry[] = entries.map((e) => ({
                id: crypto.randomUUID(),
                planningId,
                employeeId: e.employeeId,
                roleId: null as unknown as string,
                date: addDays(weekStartISO, e.dayOfWeek),
                dayOfWeek: e.dayOfWeek,
                shiftTemplateId: e.shiftTemplateId,
                startTime: e.startTime,
                endTime: e.endTime,
                effectiveHours: e.effectiveHours,
                meals: 0,
                baskets: 0,
              }))
              await savePlanningWithEntries({
                id: planningId,
                tenantId,
                weekStartDate: weekStartISO,
                weekNumber,
                status: 'draft',
                createdBy: user?.id ?? '',
                department: 'cuisine',
              }, planningEntries)
              setSaved(true)
            }}
          >
            <Save size={16} className="mr-2" /> Enregistrer
          </Button>
        )}
        {entries.length > 0 && saved && (
          <span className="flex items-center gap-1 rounded-md bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
            <CheckCircle size={16} /> Enregistré
          </span>
        )}
      </div>

      {/* Loading */}
      {generating && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-gradient-to-br from-amber-50 to-amber-100 py-16">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-amber-700">Planning cuisine en cours</p>
            <p className="mt-1 text-sm text-muted-foreground">Attribution des shifts midi et soir...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grille planning cuisine */}
      {entries.length > 0 && !generating && (
        <>
          <div className="rounded-lg border border-border">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-amber-700 text-white">
                  <th className="w-12 bg-amber-700 px-1 py-2 text-center text-[10px]">Contrat</th>
                  <th className="w-20 bg-amber-700 px-2 py-2 text-left text-xs">Cuisinier</th>
                  {DAY_NAMES.slice(1).map((day, i) => (
                    <th key={i + 1} className="px-1 py-3 text-center text-xs">
                      {day}
                    </th>
                  ))}
                  <th className="w-14 px-1 py-2 text-center text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {empTotals.map(({ emp, empEntries, totalHours, bounds }) => (
                  <tr key={emp.id} className="border-b border-border hover:bg-muted/20">
                    <td className="bg-background px-1 py-2 text-center font-mono text-[11px]">
                      {emp.weeklyHours}
                    </td>
                    <td className="bg-background px-2 py-2 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                      {emp.firstName}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((d) => {
                      const dayEntries = empEntries.filter((e) => e.dayOfWeek === d)
                      const midi = dayEntries.find((e) => e.period === 'midi')
                      const soir = dayEntries.find((e) => e.period === 'soir')
                      const isOff = dayEntries.length === 0
                      const isEditing = editingCell?.empId === emp.id && editingCell?.day === d
                      const midiShifts = getKitchenShiftsForDay(d, 'midi')
                      const soirShifts = getKitchenShiftsForDay(d, 'soir')
                      const showSoir = !(tenant?.rules.kitchenClosedSundayEvening && d === 6)

                      return (
                        <td key={d} className={`px-0.5 py-1 text-center align-top ${isOff && !isEditing ? 'bg-red-100' : 'bg-amber-50/60'}`}>
                          {isEditing ? (
                            <div className="flex flex-col gap-0.5">
                              <select
                                autoFocus
                                value={midi?.shiftTemplateId ?? ''}
                                onChange={(e) => handleShiftChange(emp.id, d, 'midi', e.target.value || null)}
                                className="w-full rounded border border-amber-400 bg-white text-[10px] py-0.5"
                              >
                                <option value="">OFF midi</option>
                                {midiShifts.map((s) => (
                                  <option key={s.id} value={s.id}>{s.startTime}h-{s.endTime}h ({s.effectiveHours}h)</option>
                                ))}
                              </select>
                              {showSoir && (
                                <select
                                  value={soir?.shiftTemplateId ?? ''}
                                  onChange={(e) => handleShiftChange(emp.id, d, 'soir', e.target.value || null)}
                                  className="w-full rounded border border-amber-600 bg-white text-[10px] py-0.5"
                                >
                                  <option value="">OFF soir</option>
                                  {soirShifts.map((s) => (
                                    <option key={s.id} value={s.id}>{s.startTime}h-{s.endTime}h ({s.effectiveHours}h)</option>
                                  ))}
                                </select>
                              )}
                              <button
                                onClick={() => setEditingCell(null)}
                                className="text-[9px] text-slate-500 hover:text-slate-800"
                              >
                                ✓ OK
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingCell({ empId: emp.id, day: d })}
                              className="flex w-full flex-col gap-0.5 items-center rounded hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer py-0.5"
                              title="Cliquer pour modifier"
                            >
                              {isOff ? (
                                <span className="text-xs text-muted-foreground">OFF</span>
                              ) : (
                                <>
                                  {midi && (
                                    <span className="inline-block rounded bg-amber-100 border border-amber-200 px-1 py-0.5 text-[10px] font-semibold leading-tight whitespace-nowrap">
                                      {midi.startTime}-{midi.endTime}h
                                    </span>
                                  )}
                                  {soir && (
                                    <span className="inline-block rounded bg-amber-600 text-white px-1 py-0.5 text-[10px] font-semibold leading-tight whitespace-nowrap">
                                      {soir.startTime}-{soir.endTime}h
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className={`px-1 py-2 text-center text-xs font-bold ${totalHours < bounds.min ? 'text-destructive' : ''}`}>
                      {totalHours}h
                      {(() => {
                        const delta = totalHours - emp.weeklyHours
                        if (delta === 0) return null
                        const sign = delta > 0 ? '+' : ''
                        return <span className={`ml-0.5 text-[9px] ${delta > 0 ? 'text-warning' : 'text-blue-600'}`}>({sign}{delta})</span>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Récap effectifs par jour */}
          <div className="rounded-lg border border-border">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="w-24 px-3 py-2 text-left font-medium">Service</th>
                  {DAY_NAMES.slice(1).map((day, i) => (
                    <th key={i + 1} className="px-2 py-2 text-center font-medium">{day}</th>
                  ))}
                  <th className="w-16 px-2 py-2 text-center font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const days = [1, 2, 3, 4, 5, 6]
                  const midiCount = (d: number) => entries.filter((e) => e.dayOfWeek === d && e.period === 'midi').length
                  const soirCount = (d: number) => entries.filter((e) => e.dayOfWeek === d && e.period === 'soir').length
                  const midiTotal = days.reduce((s, d) => s + midiCount(d), 0)
                  const soirTotal = days.reduce((s, d) => s + soirCount(d), 0)
                  return (
                    <>
                      <tr className="border-b border-border">
                        <td className="px-3 py-2 font-semibold">
                          <span className="inline-block rounded bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">Midi</span>
                        </td>
                        {days.map((d) => {
                          const n = midiCount(d)
                          const below = tenant && n < tenant.rules.minKitchenMidi
                          return (
                            <td key={d} className={`px-2 py-2 text-center font-bold ${below ? 'text-destructive' : n === 0 ? 'text-muted-foreground' : ''}`}>
                              {n}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center font-bold">{midiTotal}</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-3 py-2 font-semibold">
                          <span className="inline-block rounded bg-amber-600 text-white px-1.5 py-0.5 text-[10px] font-semibold">Soir</span>
                        </td>
                        {days.map((d) => {
                          const n = soirCount(d)
                          const closed = tenant?.rules.kitchenClosedSundayEvening && d === 6
                          return (
                            <td key={d} className={`px-2 py-2 text-center font-bold ${closed ? 'text-muted-foreground' : n === 0 ? 'text-muted-foreground' : ''}`}>
                              {closed ? '—' : n}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center font-bold">{soirTotal}</td>
                      </tr>
                      <tr className="bg-muted/40">
                        <td className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
                        {days.map((d) => (
                          <td key={d} className="px-2 py-2 text-center font-bold">
                            {midiCount(d) + soirCount(d)}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center font-bold">{midiTotal + soirTotal}</td>
                      </tr>
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>

          {solverInfo && (
            <div className="rounded-lg border border-success/50 bg-success/5 p-3 text-sm text-success">
              {solverInfo}
            </div>
          )}
        </>
      )}

      {kitchenEmployees.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun salarié cuisine. Ajoutez des salariés avec le département "Cuisine" dans l'onglet Salariés.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
