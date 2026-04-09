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
  fetchManagerSchedules,
  fetchConditionalAvailabilities,
} from '@/infrastructure/supabase/repositories/constraint-repo'
import { exportPlanningToExcel } from '@/infrastructure/export/excel-export'
import type { EventOverride } from '@/domain/engine'
import { Calendar, Download, Play, ChevronLeft, ChevronRight, AlertTriangle, Sun } from 'lucide-react'

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
  const [error, setError] = useState('')

  // Constraints loaded for display
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [conditionalAvailabilities, setConditionalAvailabilities] = useState<ConditionalAvailability[]>([])
  const [constraintsLoaded, setConstraintsLoaded] = useState(false)

  // Beau temps (weather boost) — jours cochés = CA +30%
  const [beauTempsJours, setBeauTempsJours] = useState<number[]>([])

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
    const items: { employeeName: string; type: 'fixed' | 'punctual' | 'conditional' | 'manager'; dayLabel: string; detail: string }[] = []

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
        eventOverrides: beauTempsJours.map((day): EventOverride => ({
          date: addDays(weekStartISO, day),
          revenueMultiplierPercent: 30,
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
          <Button variant="secondary" onClick={() => exportPlanningToExcel(report)}>
            <Download size={16} className="mr-2" /> Exporter Excel
          </Button>
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
      {constraintsLoaded && constraintsSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              Contraintes de la semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {DAY_NAMES.map((name, i) => (
                      <th key={i} className={`px-2 py-2 text-center font-medium ${i === 0 ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {DAY_NAMES.map((_, dayIndex) => {
                      const dayFixed = fixedConstraints.filter((c) => c.dayLabel === DAY_NAMES[dayIndex])
                      const dayPunctual = punctualConstraints.filter((c) => c.dayLabel.startsWith(DAY_NAMES[dayIndex]))
                      const items = [...dayFixed, ...dayPunctual]
                      return (
                        <td key={dayIndex} className={`px-2 py-2 align-top ${dayIndex === 0 ? 'bg-muted/30' : ''}`}>
                          {items.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {items.map((c, i) => (
                                <div
                                  key={i}
                                  className={`rounded px-2 py-1 text-xs ${
                                    c.type === 'punctual'
                                      ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                                      : 'bg-warning/10 text-warning'
                                  }`}
                                >
                                  <span className="font-medium">{c.employeeName}</span>
                                  <br />
                                  <span className="opacity-80">{c.detail}</span>
                                </div>
                              ))}
                            </div>
                          ) : dayIndex === 0 ? (
                            <span className="text-xs text-muted-foreground/50">Fermé</span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {punctualConstraints.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune contrainte ponctuelle pour cette semaine.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Beau temps — boost CA +30% */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 mb-3">
            <Sun size={18} className="text-warning" />
            <span className="text-sm font-semibold">Beau temps prévu (CA +30%)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.slice(1).map((name, i) => {
              const day = i + 1 // 1=mardi..6=dimanche
              const active = beauTempsJours.includes(day)
              return (
                <button
                  key={day}
                  onClick={() =>
                    setBeauTempsJours(
                      active ? beauTempsJours.filter((d) => d !== day) : [...beauTempsJours, day],
                    )
                  }
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-warning text-white'
                      : 'bg-background border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {active ? `${name} (+30%)` : name}
                </button>
              )
            })}
          </div>
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
      {report && <PlanningGrid report={report} />}
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
