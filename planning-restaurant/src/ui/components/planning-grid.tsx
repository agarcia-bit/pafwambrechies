import { useState, useMemo } from 'react'
import type { PlanningReport } from '@/domain/models/planning'
import type { ShiftTemplate } from '@/domain/models/shift'
import type { Employee } from '@/domain/models/employee'
import type { Unavailability } from '@/domain/models/constraint'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface PlanningGridProps {
  report: PlanningReport
  shiftTemplates: ShiftTemplate[]
  employees?: Employee[]
  roles?: { id: string; name: string; color: string }[]
  employeeRoles?: { employeeId: string; roleId: string }[]
  unavailabilities?: Unavailability[]
  weekDates?: string[]
  onShiftChange?: (employeeId: string, dayOfWeek: number, newShiftId: string | null) => void
}

export function PlanningGrid({ report, shiftTemplates, employees = [], roles = [], employeeRoles = [], unavailabilities = [], weekDates = [], onShiftChange }: PlanningGridProps) {
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

  function getRoleBadge(empId: string): { name: string; color: string } | null {
    const er = employeeRoles.find((e) => e.employeeId === empId)
    if (!er) return null
    const role = roles.find((r) => r.id === er.roleId)
    return role ? { name: role.name, color: role.color } : null
  }

  function isConstrained(empId: string, dayOfWeek: number): 'off' | 'partial' | false {
    const date = weekDates[dayOfWeek]
    for (const u of unavailabilities) {
      if (u.employeeId !== empId) continue
      if (u.type === 'fixed' && u.dayOfWeek === dayOfWeek) return 'off'
      if (u.type === 'punctual' && u.specificDate && date && u.specificDate === date) {
        if (u.availableFrom == null && u.availableUntil == null) return 'off'
        return 'partial'
      }
    }
    return false
  }

  const summaries = report.employeeSummaries.map((s) => {
    const entries = report.planning.entries.filter((e) => e.employeeId === s.employeeId)
    const plannedHours = entries.reduce((sum, e) => sum + e.effectiveHours, 0)
    const totalMeals = entries.reduce((sum, e) => sum + e.meals, 0)
    const totalBaskets = entries.reduce((sum, e) => sum + e.baskets, 0)
    return { ...s, plannedHours, totalMeals, totalBaskets }
  })

  const hourlyBreakdown = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map((day) => {
      const dayEntries = report.planning.entries.filter((e) => e.dayOfWeek === day)
      const isSunday = day === 6
      const closingTime = isSunday ? 21 : 24
      const plannedHours = dayEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
      const ds = report.dailySummaries.find((s) => s.dayOfWeek === day)
      const productivity = plannedHours > 0 && ds ? ds.forecastedRevenue / plannedHours : 0
      const hours = [9.5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
      const activeHours = hours.filter((h) => h <= closingTime)
      const byHour = activeHours.map((h) => {
        const isLast = h === closingTime
        const present = isLast
          ? dayEntries.filter((e) => e.endTime >= closingTime)
          : h === 9.5
          ? dayEntries.filter((e) => e.startTime <= 9.5)
          : dayEntries.filter((e) => e.startTime <= h && e.endTime > h)
        const byRole = new Map<string, number>()
        for (const e of present) {
          const badge = getRoleBadge(e.employeeId)
          const name = badge?.name ?? 'Autre'
          byRole.set(name, (byRole.get(name) ?? 0) + 1)
        }
        const tooltip = present.length > 0
          ? Array.from(byRole.entries()).map(([name, count]) => `${name}: ${count}`).join('\n')
          : ''
        const roleBreakdown = Array.from(byRole.entries()).map(([name, count]) => {
          const badge = roles.find((r) => r.name === name)
          return { name, count, color: badge?.color ?? '#94a3b8' }
        })
        return { hour: h, total: present.length, isLast, tooltip, roleBreakdown }
      })
      return { day, plannedHours, productivity, ca: ds?.forecastedRevenue ?? 0, closingTime, byHour }
    })
  }, [report.planning.entries, report.dailySummaries])

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="sticky left-0 z-10 bg-slate-800 px-3 py-3 text-left text-xs font-semibold">Contrat</th>
              <th className="sticky left-16 z-10 bg-slate-800 px-3 py-3 text-left text-xs font-semibold">Salarié</th>
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
              const showHeaders = sections.length > 1
              return sections.flatMap((section) => [
                ...(showHeaders ? [
                  <tr key={`dept-${section.label}`} className="bg-muted/60">
                    <td colSpan={100} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{section.label}</td>
                  </tr>,
                ] : []),
                ...section.items.map((summary) => {
                  const roleBadge = getRoleBadge(summary.employeeId)
                  return (
                <tr key={summary.employeeId} className="border-b border-border hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-center font-mono">{summary.contractHours}</td>
                  <td className="sticky left-16 z-10 bg-background px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{summary.employeeName}</span>
                      {roleBadge && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: roleBadge.color }}>
                          {roleBadge.name}
                        </span>
                      )}
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5, 6].map((d) => {
                    const entry = report.planning.entries.find((e) => e.employeeId === summary.employeeId && e.dayOfWeek === d)
                    const constraint = isConstrained(summary.employeeId, d)
                    const isOff = !entry
                    const bgClass = constraint === 'off'
                      ? 'bg-orange-100'
                      : constraint === 'partial'
                      ? 'bg-amber-50'
                      : isOff ? 'bg-red-100' : 'bg-blue-100'
                    const isEditing = editingCell?.empId === summary.employeeId && editingCell?.day === d
                    const dayShifts = getShiftsForDay(d, summary.employeeId)
                    const locked = constraint === 'off'
                    return (
                      <td key={d} className={`px-1 py-1 text-center ${bgClass} relative`}>
                        {locked ? (
                          <span className="inline-flex items-center gap-1 text-orange-700 font-medium cursor-not-allowed" title="Indisponible (contrainte)">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            OFF
                          </span>
                        ) : isEditing ? (
                          <select autoFocus className="w-full h-7 rounded border border-primary bg-background text-xs" value={entry?.shiftTemplateId ?? ''}
                            onChange={(e) => { onShiftChange?.(summary.employeeId, d, e.target.value || null); setEditingCell(null) }}
                            onBlur={() => setEditingCell(null)}>
                            <option value="">OFF</option>
                            {dayShifts.map((s) => <option key={s.id} value={s.id}>{s.startTime}→{s.endTime} ({s.effectiveHours}h)</option>)}
                          </select>
                        ) : (
                          <button onClick={() => setEditingCell({ empId: summary.employeeId, day: d })}
                            className="w-full rounded px-1 py-0.5 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer" title="Cliquer pour modifier">
                            {entry ? (
                              <span className="inline-flex gap-1">
                                <span>{entry.startTime}</span><span className="text-muted-foreground">→</span><span>{entry.endTime}</span>
                                <span className="font-bold">({entry.effectiveHours})</span>
                              </span>
                            ) : <span className="text-muted-foreground">OFF</span>}
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
                      return <span className={`ml-1 text-[10px] font-medium ${delta > 0 ? 'text-warning' : 'text-blue-600'}`}>({sign}{delta}h)</span>
                    })()}
                  </td>
                  <td className="px-2 py-1.5 text-center">{summary.totalMeals}</td>
                  <td className="px-2 py-1.5 text-center">{summary.totalBaskets}</td>
                </tr>
                  )
                }),
              ])
            })()}
          </tbody>
        </table>
      </div>

      {/* Tableau récap effectifs heure par heure */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted z-10">Jour</th>
              <th className="px-2 py-2 text-center font-medium">CA</th>
              <th className="px-2 py-2 text-center font-medium">Prod.</th>
              {(hourlyBreakdown[0]?.byHour ?? []).map((slot) => (
                <th key={slot.hour} className="px-1 py-2 text-center font-medium min-w-[32px]">
                  {slot.hour === 9.5 ? 'Ouv.' : slot.isLast ? 'Ferm.' : `${slot.hour}h`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourlyBreakdown.map(({ day, productivity, ca, byHour }) => {
              const prodOk = productivity >= 85 && productivity <= 110
              return (
                <tr key={day} className="border-b border-border">
                  <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{DAY_NAMES[day]}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{ca > 0 ? `${Math.round(ca)}€` : '—'}</td>
                  <td className={`px-2 py-2 text-center font-bold ${prodOk ? 'text-success' : 'text-destructive'}`}>
                    {productivity > 0 ? Math.round(productivity) : '—'}
                  </td>
                  {byHour.map((slot) => {
                    const bg = slot.total === 0 ? 'bg-red-50 text-red-400'
                      : slot.total <= 2 ? 'bg-amber-50'
                      : slot.total <= 4 ? 'bg-emerald-50'
                      : 'bg-emerald-100'
                    return (
                      <td key={slot.hour} className={`px-1 py-2 text-center ${bg}`}>
                        <div className="font-bold text-sm leading-tight">{slot.total}</div>
                        {slot.roleBreakdown.length > 0 && (
                          <div className="mt-1 flex flex-wrap justify-center gap-x-1 gap-y-0.5">
                            {slot.roleBreakdown.map((r) => (
                              <span key={r.name} className="inline-flex items-center gap-0.5 text-[9px] leading-none text-slate-600">
                                <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                                {r.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {roles.length > 0 && (
          <div className="flex items-center gap-4 border-t border-border px-3 py-2">
            <span className="text-[10px] font-medium text-muted-foreground">Légende :</span>
            {roles.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {report.violations.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <h3 className="mb-2 font-bold text-destructive">Ajustement manuel nécessaire ({report.violations.length})</h3>
          <ul className="space-y-1">
            {report.violations.map((v, i) => <li key={i} className="text-sm text-destructive">[{v.rule}] {v.message}</li>)}
          </ul>
        </div>
      )}

      <div className={`rounded-lg p-4 text-center font-bold ${report.isValid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
        {report.isValid ? 'PLANNING VALIDE' : 'Apporter les modifications manuelles demandées pour obtenir le planning valide'}
      </div>
    </div>
  )
}

function formatDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
