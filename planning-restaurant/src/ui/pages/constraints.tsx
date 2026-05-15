import { useEffect, useState, useRef, useMemo } from 'react'
import { getStoredToken } from '@/lib/auth-token'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { TimeInput } from '@/ui/components/time-input'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'
import {
  fetchUnavailabilities,
  fetchConditionalAvailabilities,
  createUnavailability,
  deleteUnavailability,
  upsertManagerSchedule,
  createConditionalAvailability,
  deleteConditionalAvailability,
} from '@/infrastructure/supabase/repositories/constraint-repo'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { Plus, Trash2, Save, Clock } from 'lucide-react'

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function ConstraintsPage() {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const { roles, employeeRoles, load: loadRoles } = useRoleStore()
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [allUnavailabilities, setAllUnavailabilities] = useState<Unavailability[]>([])
  const [allConditionals, setAllConditionals] = useState<ConditionalAvailability[]>([])
  const [conditionals, setConditionals] = useState<ConditionalAvailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [newDays, setNewDays] = useState<number[]>([])
  const [newLabel, setNewLabel] = useState('')

  const [condDays, setCondDays] = useState<number[]>([])
  const [condShiftCodes, setCondShiftCodes] = useState<string[]>([])
  const [condMaxHours, setCondMaxHours] = useState<string>('')

  function getRole(empId: string): { name: string; color: string } | null {
    const er = employeeRoles.find((e) => e.employeeId === empId)
    if (!er) return null
    const role = roles.find((r) => r.id === er.roleId)
    if (!role) return null
    return { name: role.name, color: role.color }
  }

  function getConstraintItems(empId: string): { type: 'off' | 'conditional'; label: string }[] {
    const items: { type: 'off' | 'conditional'; label: string }[] = []
    const offDays = allUnavailabilities
      .filter((u) => u.employeeId === empId && u.type === 'fixed' && u.dayOfWeek != null)
      .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
    if (offDays.length > 0) {
      items.push({ type: 'off', label: `OFF ${offDays.map((u) => DAY_SHORT[u.dayOfWeek!]).join(', ')}` })
    }
    const empCond = allConditionals.filter((c) => c.employeeId === empId)
    const byCodes = new Map<string, number[]>()
    for (const c of empCond) {
      const key = (c.allowedShiftCodes || []).slice().sort().join('+') || '?'
      if (!byCodes.has(key)) byCodes.set(key, [])
      byCodes.get(key)!.push(c.dayOfWeek)
    }
    for (const [codes, days] of byCodes) {
      const sortedDays = days.sort((a, b) => a - b).map((d) => DAY_SHORT[d])
      items.push({ type: 'conditional', label: `${codes} ${sortedDays.join(', ')}` })
    }
    return items
  }

  useEffect(() => {
    loadEmployees()
    loadTemplates()
    loadRoles()
    fetchUnavailabilities().then(setAllUnavailabilities).catch((e: unknown) => console.warn('[constraints]', e))
    fetchConditionalAvailabilities().then(setAllConditionals).catch((e: unknown) => console.warn('[constraints]', e))
  }, [loadEmployees, loadTemplates, loadRoles])

  const activeEmployees = useMemo(
    () => [...employees.filter((e) => e.active)].sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [employees],
  )
  const selectedEmp = activeEmployees.find((e) => e.id === selectedEmployee)

  const loadRequestIdRef = useRef(0)

  async function loadConstraints(empId: string) {
    const requestId = ++loadRequestIdRef.current
    setLoading(true)
    setLoadError('')
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const token = getStoredToken()
      async function directFetch<T>(table: string): Promise<T[]> {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/${table}?employee_id=eq.${encodeURIComponent(empId)}&order=day_of_week`,
          { headers: { apikey: apiKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
        )
        if (!res.ok) throw new Error(`${table} ${res.status}`)
        return res.json()
      }
      const results = await Promise.allSettled([
        directFetch<Record<string, unknown>>('unavailabilities').then((rows) =>
          rows.map((r) => ({ id: r.id, employeeId: r.employee_id, type: r.type, dayOfWeek: r.day_of_week, specificDate: r.specific_date, availableFrom: r.available_from, availableUntil: r.available_until, label: r.label ?? '' })) as Unavailability[],
        ),
        directFetch<Record<string, unknown>>('manager_fixed_schedules').then((rows) =>
          rows.map((r) => ({ id: r.id, employeeId: r.employee_id, dayOfWeek: r.day_of_week, shiftTemplateId: r.shift_template_id, startTime: r.start_time === null ? null : Number(r.start_time), endTime: r.end_time === null ? null : Number(r.end_time) })) as ManagerFixedSchedule[],
        ),
        directFetch<Record<string, unknown>>('conditional_availabilities').then((rows) =>
          rows.map((r) => ({ id: r.id, employeeId: r.employee_id, dayOfWeek: r.day_of_week, allowedShiftCodes: r.allowed_shift_codes ?? [], maxHours: r.max_hours === null ? null : Number(r.max_hours) })) as ConditionalAvailability[],
        ),
      ])
      if (requestId !== loadRequestIdRef.current) return
      const [uaRes, msRes, caRes] = results
      setUnavailabilities(uaRes.status === 'fulfilled' ? uaRes.value : [])
      setManagerSchedules(msRes.status === 'fulfilled' ? msRes.value : [])
      setConditionals(caRes.status === 'fulfilled' ? caRes.value : [])
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) setLoadError('Certaines données n\'ont pas pu être chargées. Réessayer ?')
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return
      setLoadError((e as Error).message || 'Erreur inconnue')
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
    }
  }

  function handleSelectEmployee(empId: string) {
    setSelectedEmployee(empId)
    if (empId) loadConstraints(empId)
  }

  function toggleDay(day: number, list: number[], setList: (v: number[]) => void) {
    setList(list.includes(day) ? list.filter((d) => d !== day) : [...list, day])
  }

  function toggleShiftCode(code: string) {
    setCondShiftCodes(condShiftCodes.includes(code) ? condShiftCodes.filter((c) => c !== code) : [...condShiftCodes, code])
  }

  async function handleAddUnavailability() {
    if (!selectedEmployee || newDays.length === 0) return
    const created: Unavailability[] = []
    for (const day of newDays) {
      const u = await createUnavailability({ employeeId: selectedEmployee, type: 'fixed', dayOfWeek: day, specificDate: null, availableFrom: null, availableUntil: null, label: newLabel || `OFF ${DAY_NAMES[day]}` })
      created.push(u)
    }
    setUnavailabilities([...unavailabilities, ...created])
    setAllUnavailabilities([...allUnavailabilities, ...created])
    setNewDays([])
    setNewLabel('')
  }

  async function handleDeleteUnavailability(id: string) {
    await deleteUnavailability(id)
    setUnavailabilities(unavailabilities.filter((u) => u.id !== id))
  }

  async function handleAddConditional() {
    if (!selectedEmployee || condDays.length === 0 || condShiftCodes.length === 0) return
    const created: ConditionalAvailability[] = []
    for (const day of condDays) {
      const ca = await createConditionalAvailability({ employeeId: selectedEmployee, dayOfWeek: day, allowedShiftCodes: condShiftCodes, maxHours: condMaxHours ? Number(condMaxHours) : null })
      created.push(ca)
    }
    setConditionals([...conditionals, ...created])
    setCondDays([])
    setCondShiftCodes([])
    setCondMaxHours('')
  }

  async function handleDeleteConditional(id: string) {
    await deleteConditionalAvailability(id)
    setConditionals(conditionals.filter((c) => c.id !== id))
  }

  async function handleSaveManagerSchedule(dayOfWeek: number, shiftTemplateId: string | null, startTime: number | null, endTime: number | null) {
    if (!selectedEmployee) return
    const saved = await upsertManagerSchedule({ employeeId: selectedEmployee, dayOfWeek, shiftTemplateId, startTime, endTime })
    setManagerSchedules([...managerSchedules.filter((s) => s.dayOfWeek !== dayOfWeek), saved])
  }

  const shiftOptions = templates.map((t) => ({ code: t.code, label: `${t.startTime}h → ${t.endTime}h` }))
  const uniqueShiftOptions = shiftOptions.filter((s, i, arr) => arr.findIndex((a) => a.code === s.code) === i)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contraintes & Disponibilités</h1>
        {selectedEmployee && (
          <Button variant="outline" onClick={() => setSelectedEmployee('')}>← Retour à la liste</Button>
        )}
      </div>

      {!selectedEmployee && (
        <Card>
          <CardHeader><CardTitle>Sélectionner un salarié</CardTitle></CardHeader>
          <CardContent>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun salarié actif.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nom</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Département</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rôle</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Contrat</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Contraintes</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp) => {
                      const role = getRole(emp.id)
                      const items = getConstraintItems(emp.id)
                      return (
                        <tr key={emp.id} className="border-b border-border hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            {emp.firstName} {emp.lastName}
                            {emp.isManager && <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Manager</span>}
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{emp.department}</td>
                          <td className="px-3 py-2">
                            {role ? <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: role.color }}>{role.name}</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs">{emp.weeklyHours}h</td>
                          <td className="px-3 py-2">
                            {items.length === 0 ? <span className="text-xs text-muted-foreground">Aucune</span> : (
                              <div className="flex flex-wrap gap-1">
                                {items.map((item, i) => <span key={i} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${item.type === 'off' ? 'bg-warning/10 text-warning' : 'bg-blue-100 text-blue-700'}`}>{item.label}</span>)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right"><Button size="sm" onClick={() => handleSelectEmployee(emp.id)}>Modifier</Button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedEmployee && selectedEmp && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{selectedEmp.firstName.charAt(0)}</div>
            <div>
              <div className="font-semibold">{selectedEmp.firstName} {selectedEmp.lastName}{selectedEmp.isManager && <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Manager</span>}</div>
              <div className="text-xs text-muted-foreground capitalize">{selectedEmp.department}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && loading && <p className="text-muted-foreground">Chargement...</p>}

      {selectedEmployee && !loading && loadError && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{loadError}</span>
          <button onClick={() => loadConstraints(selectedEmployee)} className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90">Réessayer</button>
        </div>
      )}

      {selectedEmp?.isManager && selectedEmployee && !loading && (
        <Card>
          <CardHeader><CardTitle>Horaires fixes (Manager)</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Les managers ont des horaires fixes chaque semaine.</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Jour</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Horaire</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Début</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fin</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const schedule = managerSchedules.find((s) => s.dayOfWeek === day)
                    return <ManagerDayRow key={day} day={day} dayName={DAY_NAMES[day]} schedule={schedule ?? null} templates={templates} onSave={(templateId, start, end) => handleSaveManagerSchedule(day, templateId, start, end)} />
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && !loading && (
        <Card>
          <CardHeader><CardTitle>Indisponibilités récurrentes (jours OFF)</CardTitle></CardHeader>
          <CardContent>
            {unavailabilities.filter((u) => u.type === 'fixed').length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {unavailabilities.filter((u) => u.type === 'fixed').map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div>
                      <span className="mr-2 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Récurrent</span>
                      <span className="text-sm">{u.dayOfWeek != null ? `Chaque ${DAY_NAMES[u.dayOfWeek]}` : ''}</span>
                      {u.label && <span className="ml-2 text-sm text-muted-foreground">— {u.label}</span>}
                    </div>
                    <button onClick={() => handleDeleteUnavailability(u.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-3">
                <Input id="newLabel" label="Motif (optionnel)" placeholder="ex: Cours du soir" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium">Jours (cochez plusieurs)</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((_, i) => (
                    <button key={i} onClick={() => toggleDay(i, newDays, setNewDays)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${newDays.includes(i) ? 'bg-warning text-white' : 'bg-background border border-border text-foreground hover:bg-muted'}`}>{DAY_SHORT[i]}</button>
                  ))}
                </div>
                {newDays.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{newDays.length} jour{newDays.length > 1 ? 's' : ''} sélectionné{newDays.length > 1 ? 's' : ''} : {newDays.sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ')}</p>}
              </div>
              <Button onClick={handleAddUnavailability} size="sm" disabled={newDays.length === 0}>
                <Plus size={16} className="mr-1" /> Ajouter {newDays.length > 1 ? `(${newDays.length} jours)` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEmployee && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock size={18} />Disponibilités restreintes (horaires limités)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">Pour les salariés disponibles uniquement sur certains créneaux.</p>
            {conditionals.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {conditionals.map((ca) => (
                  <div key={ca.id} className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{DAY_NAMES[ca.dayOfWeek]}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="text-blue-700">Créneaux autorisés : {ca.allowedShiftCodes.join(', ')}</span>
                      {ca.maxHours && <span className="ml-2 text-muted-foreground">(max {ca.maxHours}h)</span>}
                    </div>
                    <button onClick={() => handleDeleteConditional(ca.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-blue-50/50 p-4">
              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium">Jours concernés (cochez plusieurs)</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((_, i) => (
                    <button key={i} onClick={() => toggleDay(i, condDays, setCondDays)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${condDays.includes(i) ? 'bg-blue-600 text-white' : 'bg-background border border-border text-foreground hover:bg-muted'}`}>{DAY_SHORT[i]}</button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setCondDays([0,1,2,3,4])} className="text-xs text-blue-600 hover:underline">Lun→Ven</button>
                  <button onClick={() => setCondDays([5,6])} className="text-xs text-blue-600 hover:underline">Sam+Dim</button>
                  <button onClick={() => setCondDays([0,1,2,3,4,5,6])} className="text-xs text-blue-600 hover:underline">Tous</button>
                  <button onClick={() => setCondDays([])} className="text-xs text-muted-foreground hover:underline">Aucun</button>
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium">Créneaux autorisés uniquement</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCondShiftCodes(condShiftCodes.length === uniqueShiftOptions.length ? [] : uniqueShiftOptions.map((s) => s.code))} className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${condShiftCodes.length === uniqueShiftOptions.length ? 'bg-blue-600 text-white' : 'bg-background border-2 border-blue-400 text-blue-600 hover:bg-blue-50'}`}>Tous les créneaux</button>
                  {uniqueShiftOptions.map((s) => (
                    <button key={s.code} onClick={() => toggleShiftCode(s.code)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${condShiftCodes.includes(s.code) ? 'bg-blue-600 text-white' : 'bg-background border border-border text-foreground hover:bg-muted'}`}>{s.label}</button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">ex: sélectionnez SOIR pour \"disponible uniquement à partir de 18h\"</p>
              </div>
              <div className="mb-3 w-48">
                <Input id="condMaxHours" label="Max heures/jour (optionnel)" type="number" min={0} max={12} step={0.5} value={condMaxHours} onChange={(e) => setCondMaxHours(e.target.value)} placeholder="ex: 6" />
              </div>
              <Button onClick={handleAddConditional} size="sm" disabled={condDays.length === 0 || condShiftCodes.length === 0}>
                <Plus size={16} className="mr-1" /> Ajouter {condDays.length > 1 ? `(${condDays.length} jours)` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ManagerDayRow({
  day, dayName, schedule, templates, onSave,
}: {
  day: number
  dayName: string
  schedule: ManagerFixedSchedule | null
  templates: { id: string; code: string; label: string; startTime: number; endTime: number }[]
  onSave: (templateId: string | null, start: number | null, end: number | null) => void
}) {
  const [startTime, setStartTime] = useState(schedule?.startTime ?? null)
  const [endTime, setEndTime] = useState(schedule?.endTime ?? null)
  const [templateId, setTemplateId] = useState(schedule?.shiftTemplateId ?? '')

  const isClosed = day === 0

  return (
    <tr className={`border-b border-border ${isClosed ? 'bg-planning-off/30' : ''}`}>
      <td className="px-3 py-2 font-medium">{dayName}</td>
      <td className="px-3 py-2">
        {isClosed ? (
          <span className="text-sm text-muted-foreground">Fermé</span>
        ) : (
          <select
            value={templateId}
            onChange={(e) => {
              const newId = e.target.value
              setTemplateId(newId)
              if (newId) {
                const tpl = templates.find((t) => t.id === newId)
                if (tpl) { setStartTime(tpl.startTime); setEndTime(tpl.endTime) }
              } else { setStartTime(null); setEndTime(null) }
            }}
            className="h-8 rounded border border-input bg-background px-2 text-sm"
          >
            <option value="">OFF</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.code} ({t.startTime}→{t.endTime})</option>)}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        {!isClosed && templateId && (
          <TimeInput value={startTime ?? 0} onChange={(v) => setStartTime(v)} />
        )}
      </td>
      <td className="px-3 py-2">
        {!isClosed && templateId && (
          <TimeInput value={endTime ?? 0} onChange={(v) => setEndTime(v)} />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!isClosed && (
          <button onClick={() => onSave(templateId || null, startTime, endTime)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Enregistrer">
            <Save size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}
