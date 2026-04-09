import { useEffect, useState } from 'react'
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
import { Calendar, Download, Play, ChevronLeft, ChevronRight } from 'lucide-react'

function getNextMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day // jours jusqu'au prochain lundi
  d.setDate(d.getDate() + diff)
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

  useEffect(() => {
    loadEmployees()
    loadRoles()
    loadTemplates()
    loadForecasts()
  }, [loadEmployees, loadRoles, loadTemplates, loadForecasts])

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
    setReport(null)
  }

  const activeEmployees = employees.filter((e) => e.active)
  const weekNumber = getWeekNumber(weekStart)

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
      // Load constraints
      const [unavailabilities, managerSchedules, conditionalAvailabilities] = await Promise.all([
        fetchUnavailabilities().catch(() => [] as Unavailability[]),
        fetchManagerSchedules().catch(() => [] as ManagerFixedSchedule[]),
        fetchConditionalAvailabilities().catch(() => [] as ConditionalAvailability[]),
      ])

      const tenant: Tenant = {
        id: tenantId,
        name: '',
        address: null,
        ...DEFAULT_TENANT_CONFIG,
        createdAt: '',
      }

      const input: PlannerInput = {
        tenant,
        weekStartDate: formatISO(weekStart),
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
