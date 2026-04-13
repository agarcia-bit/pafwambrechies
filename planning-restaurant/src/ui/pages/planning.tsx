import { useEffect, useState, useMemo } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useForecastStore } from '@/store/forecast-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/ui/components'
import { PlanningGrid } from '@/ui/components/planning-grid'
import { generatePlanning } from '@/domain/engine'
import type { PlannerInput } from '@/domain/engine'
import type { PlanningReport } from '@/domain/models/planning'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'
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
import { savePlanning } from '@/infrastructure/supabase/repositories/planning-repo'
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

export function PlanningPage() {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { roles, employeeRoles, load: loadRoles } = useRoleStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const { forecasts, load: loadForecasts } = useForecastStore()
  const { tenantId } = useAuthStore()

  const [weekStart, setWeekStart] = useState(getNextMonday())
  const [report, setReport] = useState<PlanningReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Constraints loaded for display
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [conditionalAvailabilities, setConditionalAvailabilities] = useState<ConditionalAvailability[]>([])
  const [constraintsLoaded, setConstraintsLoaded] = useState(false)

  // CA adjustments per day (% override) and min staff
  const [dayAdjustments, setDayAdjustments] = useState<Record<number, { percent: number; minMidi: number; minSoir: number }>>({})

  function getDayAdjustment(day: number) {
    return dayAdjustments[day] ?? { percent: 0, minMidi: 0, minSoir: 0 }
  }

  function setDayField(day: number, field: 'percent' | 'minMidi' | 'minSoir', value: number) {
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
    loadEmployees()
    loadRoles()
    loadTemplates()
    loadForecasts()
    // Constraints: fetch inline to satisfy strict lint (no setState before async)
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
  }, [loadEmployees, loadRoles, loadTemplates, loadForecasts])

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
    setReport(null)
    setSaved(false)
    reloadConstraints()
  }

  const activeEmployees = employees.filter((e) => e.active)
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
            detail: ua.label || 'Indisponible (ponctuel)',
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

  async function handleGenerate() {
    if (!tenantId) return
    setGenerating(true)
    setSaved(false)
    setError('')

    try {
      const tenant: Tenant = {
        id: tenantId,
        name: '',
        address: null,
        ...DEFAULT_TENANT_CONFIG,
        createdAt: '',
      }

      const input: PlannerInput = {
        tenant,
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

      const result = generatePlanning(input)
      setReport(result)
    } catch (e) {
      setError((e as Error).message)
    }
    setGenerating(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Génération de Planning</h1>
        {report && (
          <div className="flex gap-2">
            {!saved ? (
              <Button
                variant="primary"
                onClick={async () => {
                  if (!tenantId) return
                  await savePlanning({
                    id: report.planning.id,
                    tenantId,
                    weekStartDate: report.planning.weekStartDate,
                    weekNumber: report.planning.weekNumber,
                    status: 'draft',
                    createdBy: tenantId,
                  })
                  setSaved(true)
                }}
              >
                <Save size={16} className="mr-2" /> Enregistrer
              </Button>
            ) : (
              <span className="flex items-center gap-1 rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
                <CheckCircle size={16} /> Enregistré
              </span>
            )}
            <Button variant="secondary" onClick={() => exportPlanningToExcel(report)}>
              <Download size={16} className="mr-2" /> Exporter Excel
            </Button>
          </div>
        )}
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

      {/* Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Prérequis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <CheckItem ok={checks.employees} label={`Salariés (${activeEmployees.length})`} />
            <CheckItem ok={checks.roles} label={`Rôles (${roles.length})`} />
            <CheckItem ok={checks.templates} label={`Créneaux (${templates.length})`} />
            <CheckItem ok={checks.forecasts} label={`CA prévu (${forecasts.length})`} />
          </div>
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
                      const emp = activeEmployees.find((e) => e.id === newConstraintEmpId)
                      const empName = emp?.firstName ?? ''
                      const dayName = DAY_NAMES[newConstraintDay]

                      let label = `OFF ${empName} ${dayName}`
                      let availableFrom: number | null = null
                      let availableUntil: number | null = null

                      if (newConstraintType === 'from') {
                        availableFrom = newConstraintHour
                        label = `${empName} dispo à partir de ${newConstraintHour}h ${dayName}`
                      } else if (newConstraintType === 'until') {
                        availableUntil = newConstraintHour
                        label = `${empName} doit partir avant ${newConstraintHour}h ${dayName}`
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
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {DAY_NAMES.slice(1).map((name, i) => (
                      <th key={i + 1} className="px-2 py-2 text-center font-medium text-muted-foreground">
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
            const totalMaxHours = activeEmployees.reduce((sum, e) => sum + e.weeklyHours + e.modulationRange, 0)
            const weekProductivity = totalMaxHours > 0 ? totalCA / totalMaxHours : 0
            const needRecruit = weekProductivity > 110

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
                        <td className="px-2 py-2 text-center font-bold">{Math.round(totalCA / (1 + 0))}€</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Ajustement %</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          const adj = getDayAdjustment(day).percent
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                step={5}
                                value={adj}
                                onChange={(e) => setDayField(day, 'percent', Number(e.target.value))}
                                className={`w-16 h-7 rounded border text-center text-xs ${adj !== 0 ? 'border-warning bg-warning/10 font-bold' : 'border-input bg-background'}`}
                              />
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Min midi</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={15}
                                value={getDayAdjustment(day).minMidi}
                                onChange={(e) => setDayField(day, 'minMidi', Number(e.target.value))}
                                className="w-12 h-7 rounded border border-input bg-background text-center text-xs"
                              />
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-2 py-2 text-sm font-medium">Min soir</td>
                        {DAY_NAMES.slice(1).map((_, i) => {
                          const day = i + 1
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={15}
                                value={getDayAdjustment(day).minSoir}
                                onChange={(e) => setDayField(day, 'minSoir', Number(e.target.value))}
                                className="w-12 h-7 rounded border border-input bg-background text-center text-xs"
                              />
                            </td>
                          )
                        })}
                        <td className="px-2 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Indicateur productivité semaine */}
                <div className={`mt-4 flex items-center justify-between rounded-lg p-4 ${needRecruit ? 'bg-destructive/10 border border-destructive/30' : 'bg-success/10 border border-success/30'}`}>
                  <div>
                    <p className="text-sm font-bold">Productivité semaine estimée</p>
                    <p className="text-xs text-muted-foreground">
                      CA total : {Math.round(totalCA).toLocaleString('fr-FR')}€ / Heures max dispo : {totalMaxHours}h
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${needRecruit ? 'text-destructive' : 'text-success'}`}>
                      {Math.round(weekProductivity)}
                    </p>
                    <p className={`text-xs font-medium ${needRecruit ? 'text-destructive' : 'text-success'}`}>
                      {needRecruit ? 'Recrutement nécessaire' : 'Effectif suffisant'}
                    </p>
                  </div>
                </div>
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Bouton générer */}
      <Button
        size="lg"
        className="self-center px-12"
        onClick={handleGenerate}
        disabled={!allReady || generating}
      >
        <Play size={18} className="mr-2" />
        {generating ? 'Génération en cours...' : 'Générer le planning'}
      </Button>

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
          onShiftChange={(employeeId, dayOfWeek, newShiftId) => {
            if (!report) return
            const entries = report.planning.entries

            // Remove existing entry for this employee+day
            const filtered = entries.filter(
              (e) => !(e.employeeId === employeeId && e.dayOfWeek === dayOfWeek),
            )

            if (newShiftId) {
              // Add new entry with the selected shift
              const template = templates.find((t) => t.id === newShiftId)
              if (template) {
                const weekStartISO2 = formatISO(weekStart)
                filtered.push({
                  id: crypto.randomUUID(),
                  planningId: report.planning.id,
                  employeeId,
                  roleId: employeeRoles.find((er) => er.employeeId === employeeId)?.roleId ?? '',
                  date: addDays(weekStartISO2, dayOfWeek),
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

            // Update report with new entries — recalculate summaries
            const newReport = { ...report }
            newReport.planning = { ...report.planning, entries: filtered }

            // Recalculate employee summaries
            newReport.employeeSummaries = report.employeeSummaries.map((s) => {
              const empEntries = filtered.filter((e) => e.employeeId === s.employeeId)
              const plannedHours = empEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
              return {
                ...s,
                plannedHours,
                status: plannedHours < s.boundsMin ? 'under' as const : plannedHours > s.boundsMax ? 'over' as const : 'ok' as const,
                totalMeals: empEntries.reduce((sum, e) => sum + e.meals, 0),
                totalBaskets: empEntries.reduce((sum, e) => sum + e.baskets, 0),
              }
            })

            setReport(newReport)
            setSaved(false)
          }}
        />
      )}
    </div>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${ok ? 'bg-success/10' : 'bg-muted'}`}>
      <span className={`text-sm ${ok ? 'text-success' : 'text-muted-foreground'}`}>
        {ok ? '✓' : '○'}
      </span>
      <span className={`text-sm ${ok ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}
