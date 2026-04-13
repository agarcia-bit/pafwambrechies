import { useState } from 'react'
import type { PlanningReport } from '@/domain/models/planning'
import type { ShiftTemplate } from '@/domain/models/shift'
import type { Employee } from '@/domain/models/employee'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface PlanningGridProps {
  report: PlanningReport
  shiftTemplates: ShiftTemplate[]
  employees?: Employee[]
  onShiftChange?: (employeeId: string, dayOfWeek: number, newShiftId: string | null) => void
}

export function PlanningGrid({ report, shiftTemplates, employees = [], onShiftChange }: PlanningGridProps) {
  const [editingCell, setEditingCell] = useState<{ empId: string; day: number } | null>(null)

  function getShiftsForDay(dayOfWeek: number, employeeId?: string): ShiftTemplate[] {
    const isSunday = dayOfWeek === 6
    const isSaturday = dayOfWeek === 5
    const dept = employees.find((e) => e.id === employeeId)?.department ?? 'salle'
    return shiftTemplates
      .filter((s) => s.department === dept)
      .filter((s) => {
        if (isSunday) return s.applicability === 'sunday'
        if (isSaturday) return s.applicability === 'tue_sat' || s.applicability === 'sat_only'
        return s.applicability === 'tue_sat'
      })
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)
  }

  // Recalculate summaries from current entries
  const summaries = report.employeeSummaries.map((s) => {
    const entries = report.planning.entries.filter((e) => e.employeeId === s.employeeId)
    const plannedHours = entries.reduce((sum, e) => sum + e.effectiveHours, 0)
    const totalMeals = entries.reduce((sum, e) => sum + e.meals, 0)
    const totalBaskets = entries.reduce((sum, e) => sum + e.baskets, 0)
    return { ...s, plannedHours, totalMeals, totalBaskets }
  })

  // Recalculate daily stats
  const dailyStats = report.dailySummaries.map((ds) => {
    const dayEntries = report.planning.entries.filter((e) => e.dayOfWeek === ds.dayOfWeek)
    const plannedHours = dayEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
    const productivity = plannedHours > 0 ? ds.forecastedRevenue / plannedHours : 0
    return { ...ds, plannedHours, productivity }
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Grille principale */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="sticky left-0 z-10 bg-primary px-2 py-2 text-left">Contrat</th>
              <th className="sticky left-16 z-10 bg-primary px-2 py-2 text-left">Salarié</th>
              {DAY_NAMES.slice(1).map((day, i) => {
                const dayIdx = i + 1
                return (
                  <th key={dayIdx} className="px-1 py-2 text-center min-w-[120px]">
                    {day}
                    {report.dailySummaries.find((d) => d.dayOfWeek === dayIdx) && (
                      <div className="text-[10px] font-normal opacity-75">
                        {formatDateShort(report.dailySummaries.find((d) => d.dayOfWeek === dayIdx)?.date ?? '')}
                      </div>
                    )}
                  </th>
                )
              })}
              <th className="px-2 py-2 text-center">Total</th>
              <th className="px-2 py-2 text-center">Repas</th>
              <th className="px-2 py-2 text-center">Paniers</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const getDept = (empId: string) => employees.find((e) => e.id === empId)?.department ?? 'salle'
              const salleSummaries = summaries.filter((s) => getDept(s.employeeId) === 'salle')
              const cuisineSummaries = summaries.filter((s) => getDept(s.employeeId) === 'cuisine')
              const sections = [
                ...(salleSummaries.length > 0 ? [{ label: 'Salle', items: salleSummaries }] : []),
                ...(cuisineSummaries.length > 0 ? [{ label: 'Cuisine', items: cuisineSummaries }] : []),
              ]
              // If only one section, don't show headers
              const showHeaders = sections.length > 1

              return sections.flatMap((section) => [
                ...(showHeaders ? [
                  <tr key={`dept-${section.label}`} className="bg-muted/60">
                    <td colSpan={100} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </td>
                  </tr>,
                ] : []),
                ...section.items.map((summary) => (
              <tr key={summary.employeeId} className="border-b border-border hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-center font-mono">
                  {summary.contractHours}
                </td>
                <td className="sticky left-16 z-10 bg-background px-2 py-1.5 font-medium whitespace-nowrap">
                  {summary.employeeName}
                </td>
                {[1, 2, 3, 4, 5, 6].map((d) => {
                  const entry = report.planning.entries.find(
                    (e) => e.employeeId === summary.employeeId && e.dayOfWeek === d,
                  )
                  const isOff = !entry
                  const bgClass = isOff ? 'bg-red-100' : 'bg-blue-50/60'
                  const isEditing = editingCell?.empId === summary.employeeId && editingCell?.day === d
                  const dayShifts = getShiftsForDay(d, summary.employeeId)

                  return (
                    <td key={d} className={`px-1 py-1 text-center ${bgClass} relative`}>
                      {isEditing ? (
                        <select
                          autoFocus
                          className="w-full h-7 rounded border border-primary bg-background text-xs"
                          value={entry?.shiftTemplateId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            onShiftChange?.(summary.employeeId, d, val || null)
                            setEditingCell(null)
                          }}
                          onBlur={() => setEditingCell(null)}
                        >
                          <option value="">OFF</option>
                          {dayShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.startTime}→{s.endTime} ({s.effectiveHours}h)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingCell({ empId: summary.employeeId, day: d })}
                          className="w-full rounded px-1 py-0.5 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                          title="Cliquer pour modifier"
                        >
                          {entry ? (
                            <span className="inline-flex gap-1">
                              <span>{entry.startTime}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{entry.endTime}</span>
                              <span className="font-bold">({entry.effectiveHours})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">OFF</span>
                          )}
                        </button>
                      )}
                    </td>
                  )
                })}
                <td className={`px-2 py-1.5 text-center font-bold ${summary.plannedHours < summary.contractHours ? 'text-destructive' : ''}`}>
                  {summary.plannedHours}h
                  {(() => {
                    const delta = summary.plannedHours - summary.contractHours
                    if (delta === 0) return null
                    const sign = delta > 0 ? '+' : ''
                    const color = delta > 0 ? 'text-warning' : 'text-blue-600'
                    return (
                      <span className={`ml-1 text-[10px] font-medium ${color}`}>
                        ({sign}{delta}h)
                      </span>
                    )
                  })()}
                </td>
                <td className="px-2 py-1.5 text-center">{summary.totalMeals}</td>
                <td className="px-2 py-1.5 text-center">{summary.totalBaskets}</td>
              </tr>
                )),
              ])
            })()}
          </tbody>
        </table>
      </div>

      {/* Tableau productivité */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-left font-medium">Jour</th>
              <th className="px-3 py-2 text-center font-medium">CA cible</th>
              <th className="px-3 py-2 text-center font-medium">Heures</th>
              <th className="px-3 py-2 text-center font-medium">Productivité</th>
              <th className="px-3 py-2 text-center font-medium">Ouverture</th>
              <th className="px-3 py-2 text-center font-medium">Midi</th>
              <th className="px-3 py-2 text-center font-medium">A-midi</th>
              <th className="px-3 py-2 text-center font-medium">Soir</th>
              <th className="px-3 py-2 text-center font-medium">Fermeture</th>
            </tr>
          </thead>
          <tbody>
            {dailyStats.map((ds) => {
              const prodLevel = (ds.productivity >= 85 && ds.productivity <= 110) ? 'good' : 'bad'
              return (
                <tr key={ds.dayOfWeek} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">{DAY_NAMES[ds.dayOfWeek]}</td>
                  <td className="px-3 py-2 text-center">{ds.forecastedRevenue.toLocaleString('fr-FR')}€</td>
                  <td className="px-3 py-2 text-center">{ds.plannedHours}h</td>
                  <td className={`px-3 py-2 text-center font-bold ${prodLevel === 'good' ? 'text-success' : 'text-destructive'}`}>
                    {ds.productivity > 0 ? Math.round(ds.productivity) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-center ${ds.openingStaff === 0 ? 'text-destructive font-bold' : ''}`}>{ds.openingStaff}</td>
                  <td className="px-3 py-2 text-center">{ds.coverageMidi}</td>
                  <td className="px-3 py-2 text-center">{ds.coverageApresMidi}</td>
                  <td className="px-3 py-2 text-center">{ds.coverageSoir}</td>
                  <td className="px-3 py-2 text-center">{ds.closingStaff}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Violations */}
      {report.violations.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <h3 className="mb-2 font-bold text-destructive">
            Violations ({report.violations.length})
          </h3>
          <ul className="space-y-1">
            {report.violations.map((v, i) => (
              <li key={i} className="text-sm text-destructive">
                [{v.rule}] {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/50 bg-warning/5 p-4">
          <h3 className="mb-2 font-bold text-warning">
            Avertissements ({report.warnings.length})
          </h3>
          <ul className="space-y-1">
            {report.warnings.map((w, i) => (
              <li key={i} className="text-sm">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Statut */}
      <div className={`rounded-lg p-4 text-center font-bold ${report.isValid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
        {report.isValid ? 'PLANNING VALIDE' : 'PLANNING INVALIDE — Voir les violations ci-dessus'}
      </div>
    </div>
  )
}

function formatDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
