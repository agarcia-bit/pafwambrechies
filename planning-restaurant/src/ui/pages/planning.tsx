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
import { Calendar, Download, Play, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

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

      // Fixed unavailabilities
      for (const ua of unavailabilities.filter((u) => u.employeeId === emp.id && u.type === 'fixed')) {
        if (ua.dayOfWeek != null) {
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

      // Manager OFF days only (not their working hours)
      if (emp.isManager) {
        for (const ms of managerSchedules.filter((s) => s.employeeId === emp.id)) {
          if (!ms.shiftTemplateId) {
            items.push({
              employeeName: empName,
              type: 'manager',
              dayLabel: DAY_NAMES[ms.dayOfWeek],
              detail: 'OFF (repos)',
            })
          }
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

      {/* Rappel des contraintes */}
      {constraintsLoaded && constraintsSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              Contraintes de la semaine
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Contraintes fixes (repos managers, indispos récurrentes) */}
            {fixedConstraints.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Contraintes fixes (chaque semaine)
                </h4>
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {fixedConstraints.map((c, i) => (
                    <div key={`fixed-${i}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                      <span className="font-medium">{c.employeeName}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-muted-foreground">{c.dayLabel}</span>
                      <span className={c.detail === 'OFF (repos)' || c.detail === 'Indisponible' ? 'font-medium text-warning' : ''}>
                        {c.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contraintes ponctuelles (cette semaine uniquement) */}
            {punctualConstraints.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-destructive">
                  Contraintes ponctuelles (cette semaine)
                </h4>
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {punctualConstraints.map((c, i) => (
                    <div key={`punct-${i}`} className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-1.5 text-sm">
                      <span className="font-medium">{c.employeeName}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className="font-medium text-destructive">{c.dayLabel}</span>
                      <span className="text-destructive">{c.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {punctualConstraints.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune contrainte ponctuelle pour cette semaine.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
