import { useEffect, useState } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Card, CardContent } from '@/ui/components'
import { callKitchenSolver } from '@/infrastructure/api/solver-api'
import type { SolverShiftAssignment } from '@/infrastructure/api/solver-api'
import { fetchUnavailabilities } from '@/infrastructure/supabase/repositories/constraint-repo'
import type { Unavailability } from '@/domain/models/constraint'
import { getWeeklyBounds } from '@/domain/models/employee'
import { Calendar, Play, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface KitchenEntry {
  employeeId: string
  dayOfWeek: number
  startTime: number
  endTime: number
  effectiveHours: number
  period: 'midi' | 'soir'
}

export function KitchenPlanningPage() {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const { tenantId } = useAuthStore()

  const [weekStart, setWeekStart] = useState(getNextMonday())
  const [entries, setEntries] = useState<KitchenEntry[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [solverInfo, setSolverInfo] = useState('')
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])

  useEffect(() => {
    loadEmployees()
    loadTemplates()
    fetchUnavailabilities().then(setUnavailabilities).catch(() => {})
  }, [loadEmployees, loadTemplates])

  const kitchenEmployees = employees.filter((e) => e.active && e.department === 'cuisine')
  const weekNumber = getWeekNumber(weekStart)
  const weekStartISO = formatISO(weekStart)

  function shiftWeek(delta: number) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
    setEntries([])
    setSolverInfo('')
  }

  async function handleGenerate() {
    if (!tenantId) return
    setGenerating(true)
    setEntries([])
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
        day_forecasts: [],
        event_overrides: [],
        employee_roles: {},
        closing_time_week: 23,
        closing_time_sunday: 17,
        productivity_target: 95,
      }

      const result = await callKitchenSolver(solverReq)

      if (!result.success) {
        setError(`Cuisine: ${result.warnings.join(', ')}`)
      } else {
        const mapped: KitchenEntry[] = result.entries.map((e: SolverShiftAssignment) => ({
          employeeId: e.employee_id,
          dayOfWeek: e.day_of_week,
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
      </div>

      {/* Loading */}
      {generating && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-gradient-to-br from-orange-50 to-orange-100 py-16">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-orange-700">Planning cuisine en cours</p>
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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-orange-600 text-white">
                  <th className="sticky left-0 z-10 bg-orange-600 px-2 py-2 text-left">Contrat</th>
                  <th className="sticky left-16 z-10 bg-orange-600 px-2 py-2 text-left">Cuisinier</th>
                  {DAY_NAMES.slice(1).map((day, i) => (
                    <th key={i + 1} className="px-1 py-2 text-center min-w-[140px]">
                      {day}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {empTotals.map(({ emp, empEntries, totalHours, bounds }) => (
                  <tr key={emp.id} className="border-b border-border hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-center font-mono">
                      {emp.weeklyHours}
                    </td>
                    <td className="sticky left-16 z-10 bg-background px-2 py-1.5 font-medium whitespace-nowrap">
                      {emp.firstName}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((d) => {
                      const dayEntries = empEntries.filter((e) => e.dayOfWeek === d)
                      const midi = dayEntries.find((e) => e.period === 'midi')
                      const soir = dayEntries.find((e) => e.period === 'soir')
                      const isOff = dayEntries.length === 0

                      return (
                        <td key={d} className={`px-1 py-1 text-center ${isOff ? 'bg-planning-off/40' : 'bg-orange-50'}`}>
                          {isOff ? (
                            <span className="text-muted-foreground">OFF</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {midi && (
                                <span className="rounded bg-orange-200 px-1 py-0.5 text-[10px] font-medium">
                                  {midi.startTime}→{midi.endTime} ({midi.effectiveHours}h)
                                </span>
                              )}
                              {soir && (
                                <span className="rounded bg-orange-400 text-white px-1 py-0.5 text-[10px] font-medium">
                                  {soir.startTime}→{soir.endTime} ({soir.effectiveHours}h)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className={`px-2 py-1.5 text-center font-bold ${totalHours < bounds.min ? 'text-destructive' : ''}`}>
                      {totalHours}h
                      {(() => {
                        const delta = totalHours - emp.weeklyHours
                        if (delta === 0) return null
                        const sign = delta > 0 ? '+' : ''
                        return <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-warning' : 'text-blue-600'}`}>({sign}{delta}h)</span>
                      })()}
                    </td>
                  </tr>
                ))}
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
