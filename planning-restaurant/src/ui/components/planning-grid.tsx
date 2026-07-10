import { useState, useMemo } from 'react'
import type { PlanningReport } from '@/domain/models/planning'
import type { ShiftTemplate } from '@/domain/models/shift'
import type { Employee } from '@/domain/models/employee'
import type { Unavailability } from '@/domain/models/constraint'
import type { ServiceSlot } from '@/domain/models/tenant'
import { DEFAULT_SERVICE_SLOTS } from '@/domain/models/tenant'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type SortKey = 'name' | 'role' | 'contract'

interface PlanningGridProps {
  report: PlanningReport
  shiftTemplates: ShiftTemplate[]
  employees?: Employee[]
  roles?: { id: string; name: string; color: string }[]
  employeeRoles?: { employeeId: string; roleId: string }[]
  unavailabilities?: Unavailability[]
  weekDates?: string[]
  serviceSlots?: ServiceSlot[]
  showRoleBadges?: boolean
  closingTimeWeek?: number
  closingTimeSunday?: number
  onShiftChange?: (employeeId: string, dayOfWeek: number, newShiftId: string | null) => void
}

export function PlanningGrid({ report, shiftTemplates, employees = [], roles = [], employeeRoles = [], unavailabilities = [], weekDates = [], serviceSlots, showRoleBadges = true, closingTimeWeek = 23, closingTimeSunday = 21, onShiftChange }: PlanningGridProps) {
  const activeSlots: ServiceSlot[] = (serviceSlots && serviceSlots.length > 0) ? serviceSlots : DEFAULT_SERVICE_SLOTS

  // Résout les bornes d'un créneau pour un jour donné (gère "fin = fermeture du jour")
  function resolveSlot(slot: ServiceSlot, dayOfWeek: number): { start: number; end: number } {
    const dayClosing = dayOfWeek === 6 ? closingTimeSunday : closingTimeWeek
    const start = slot.startAtClosing ? dayClosing + slot.startTime : slot.startTime
    const end = slot.endAtClosing ? dayClosing + slot.endTime : slot.endTime
    return { start, end }
  }
  const [editingCell, setEditingCell] = useState<{ empId: string; day: number } | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={10} className="ml-1 opacity-30" />
    return sortDir === 'asc' ? <ArrowUp size={10} className="ml-1" /> : <ArrowDown size={10} className="ml-1" />
  }

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

  const sortedSummaries = useMemo(() => {
    const list = [...summaries]
    const dir = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.employeeName.localeCompare(b.employeeName)
        case 'role': {
          const ra = getRoleBadge(a.employeeId)?.name ?? 'zzz'
          const rb = getRoleBadge(b.employeeId)?.name ?? 'zzz'
          return dir * ra.localeCompare(rb)
        }
        case 'contract': return dir * (a.contractHours - b.contractHours)
        default: return 0
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, sortKey, sortDir, employeeRoles, roles])

  function countForSlot(dayEntries: { startTime: number; endTime: number; employeeId: string }[], start: number, end: number) {
    // Point unique (start == end) : présent = quelqu'un dont le shift couvre ce point.
    if (end <= start) {
      return dayEntries.filter((e) => e.startTime <= start && e.endTime > start)
    }
    // Chevauchement classique : présent si son shift chevauche la fenêtre [start, end)
    return dayEntries.filter((e) => e.startTime < end && e.endTime > start)
  }

  const serviceBreakdown = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map((day) => {
      const dayEntries = report.planning.entries.filter((e) => e.dayOfWeek === day)
      const plannedHours = dayEntries.reduce((sum, e) => sum + e.effectiveHours, 0)
      const ds = report.dailySummaries.find((s) => s.dayOfWeek === day)
      const productivity = plannedHours > 0 && ds ? ds.forecastedRevenue / plannedHours : 0

      const bySlot = activeSlots.map((slot) => {
        const { start, end } = resolveSlot(slot, day)
        const present = countForSlot(dayEntries, start, end)
        const byRole = new Map<string, number>()
        for (const e of present) {
          const badge = getRoleBadge(e.employeeId)
          const name = badge?.name ?? 'Autre'
          byRole.set(name, (byRole.get(name) ?? 0) + 1)
        }
        const roleBreakdown = Array.from(byRole.entries()).map(([name, count]) => {
          const r = roles.find((r) => r.name === name)
          return { name, count, color: r?.color ?? '#94a3b8' }
        })
        return { ...slot, total: present.length, roleBreakdown }
      })

      return { day, plannedHours, productivity, ca: ds?.forecastedRevenue ?? 0, bySlot }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.planning.entries, report.dailySummaries, activeSlots, closingTimeWeek, closingTimeSunday])

  return (
    <div className="flex flex-col gap-4">
      {/* Planning grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th scope="col" onClick={() => toggleSort('contract')}
                className="sticky left-0 z-10 bg-slate-800 px-3 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-slate-700 select-none">
                <span className="inline-flex items-center">Contrat<SortIcon col="contract" /></span>
              </th>
              <th scope="col" onClick={() => toggleSort('name')}
                className="sticky left-16 z-10 bg-slate-800 px-3 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-slate-700 select-none">
                <span className="inline-flex items-center">Salarié<SortIcon col="name" /></span>
              </th>
              <th scope="col" onClick={() => toggleSort('role')}
                className="bg-slate-800 px-2 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-slate-700 select-none">
                <span className="inline-flex items-center">Rôle<SortIcon col="role" /></span>
              </th>
              {DAY_NAMES.slice(1).map((day, i) => {
                const dayIdx = i + 1
                return (
                  <th key={dayIdx} scope="col"
                    onClick={() => setSelectedDay(selectedDay === dayIdx ? null : dayIdx)}
                    className={`px-1 py-2 text-center min-w-[120px] cursor-pointer transition-colors ${selectedDay === dayIdx ? 'bg-primary/30 ring-2 ring-inset ring-primary' : 'hover:bg-slate-700'}`}>
                    {day}
                    {report.dailySummaries.find((d) => d.dayOfWeek === dayIdx) && (
                      <div className="text-[10px] font-normal opacity-75">
                        {formatDateShort(report.dailySummaries.find((d) => d.dayOfWeek === dayIdx)?.date ?? '')}
                      </div>
                    )}
                  </th>
                )
              })}
              <th scope="col" className="px-2 py-2 text-center">Total</th>
              <th scope="col" className="px-2 py-2 text-center">Repas</th>
              <th scope="col" className="px-2 py-2 text-center">Paniers</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const getDept = (empId: string) => employees.find((e) => e.id === empId)?.department ?? 'salle'
              const salleSorted = sortedSummaries.filter((s) => getDept(s.employeeId) === 'salle')
              const cuisineSorted = sortedSummaries.filter((s) => getDept(s.employeeId) === 'cuisine')
              const sections = [
                ...(salleSorted.length > 0 ? [{ label: 'Salle', items: salleSorted }] : []),
                ...(cuisineSorted.length > 0 ? [{ label: 'Cuisine', items: cuisineSorted }] : []),
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
                  const isRowSelected = selectedEmpId === summary.employeeId
                  return (
                <tr key={summary.employeeId}
                  onClick={() => setSelectedEmpId(isRowSelected ? null : summary.employeeId)}
                  className={`border-b border-border cursor-pointer transition-colors ${isRowSelected ? 'ring-2 ring-inset ring-primary bg-primary/10' : 'hover:bg-muted/20'}`}>
                  <td className={`sticky left-0 z-10 px-2 py-1.5 text-center font-mono ${isRowSelected ? 'bg-primary/10' : 'bg-background'}`}>{summary.contractHours}</td>
                  <td className={`sticky left-16 z-10 px-2 py-1.5 whitespace-nowrap font-medium ${isRowSelected ? 'bg-primary/10' : 'bg-background'}`}>
                    {summary.employeeName}
                  </td>
                  <td className={`px-2 py-1.5 ${isRowSelected ? 'bg-primary/10' : ''}`}>
                    {roleBadge ? (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white whitespace-nowrap" style={{ backgroundColor: roleBadge.color }}>
                        {roleBadge.name}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">—</span>
                    )}
                  </td>
                  {[1, 2, 3, 4, 5, 6].map((d) => {
                    const entry = report.planning.entries.find((e) => e.employeeId === summary.employeeId && e.dayOfWeek === d)
                    const constraint = isConstrained(summary.employeeId, d)
                    const isOff = !entry
                    const isColSelected = selectedDay === d
                    const isHighlighted = isRowSelected || isColSelected
                    const bgClass = isHighlighted
                      ? 'bg-primary/10'
                      : constraint === 'off' ? 'bg-orange-100'
                      : constraint === 'partial' ? 'bg-amber-50'
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
                          <button onClick={(e) => { e.stopPropagation(); setEditingCell({ empId: summary.employeeId, day: d }) }}
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

      {/* Tableau récap effectifs par catégorie de service */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th scope="col" className="px-3 py-2 text-left font-medium sticky left-0 bg-muted z-10">Jour</th>
              <th scope="col" className="px-2 py-2 text-center font-medium">CA</th>
              <th scope="col" className="px-2 py-2 text-center font-medium">Prod.</th>
              {activeSlots.map((slot) => (
                <th key={slot.key} scope="col" className="px-2 py-2 text-center font-medium min-w-[70px]">
                  <div className="leading-tight">{slot.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {serviceBreakdown.map(({ day, productivity, ca, bySlot }) => {
              const prodOk = productivity >= 85 && productivity <= 110
              const isDaySelected = selectedDay === day
              return (
                <tr key={day}
                  onClick={() => setSelectedDay(isDaySelected ? null : day)}
                  className={`border-b border-border cursor-pointer transition-colors ${isDaySelected ? 'ring-2 ring-inset ring-primary' : 'hover:bg-muted/30'}`}>
                  <td className={`px-3 py-2 font-medium sticky left-0 z-10 ${isDaySelected ? 'bg-primary/10' : 'bg-background'}`}>{DAY_NAMES[day]}</td>
                  <td className={`px-2 py-2 text-center text-muted-foreground ${isDaySelected ? 'bg-primary/10' : ''}`}>{ca > 0 ? `${Math.round(ca)}€` : '—'}</td>
                  <td className={`px-2 py-2 text-center font-bold ${isDaySelected ? 'bg-primary/10' : ''} ${prodOk ? 'text-success' : 'text-destructive'}`}>
                    {productivity > 0 ? Math.round(productivity) : '—'}
                  </td>
                  {bySlot.map((slot) => {
                    const bg = isDaySelected ? 'bg-primary/10'
                      : slot.total === 0 ? 'bg-red-50 text-red-400'
                      : slot.total <= 2 ? 'bg-amber-50'
                      : slot.total <= 4 ? 'bg-emerald-50'
                      : 'bg-emerald-100'
                    return (
                      <td key={slot.key} className={`px-2 py-2 text-center ${bg}`}>
                        <div className="font-bold text-sm leading-tight">{slot.total}</div>
                        {showRoleBadges && slot.roleBreakdown.length > 0 && (
                          <div className="mt-1 grid grid-cols-2 gap-x-1 gap-y-0 justify-items-center mx-auto" style={{ width: 'fit-content' }}>
                            {slot.roleBreakdown.map((r) => (
                              <span key={r.name} className="inline-flex items-center gap-0.5 text-[8px] leading-tight text-slate-600">
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
        {showRoleBadges && roles.length > 0 && (
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
