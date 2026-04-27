import { useEffect, useState } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { Button, Select, Input, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'
import {
  fetchUnavailabilities,
  createUnavailability,
  deleteUnavailability,
  fetchManagerSchedules,
  upsertManagerSchedule,
  fetchConditionalAvailabilities,
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
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [conditionals, setConditionals] = useState<ConditionalAvailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [loading, setLoading] = useState(false)

  // Unavailability form
  const [newType, setNewType] = useState<'fixed' | 'punctual'>('fixed')
  const [newDays, setNewDays] = useState<number[]>([])
  const [newDates, setNewDates] = useState<string[]>([''])
  const [newLabel, setNewLabel] = useState('')

  // Conditional availability form
  const [condDays, setCondDays] = useState<number[]>([])
  const [condShiftCodes, setCondShiftCodes] = useState<string[]>([])
  const [condMaxHours, setCondMaxHours] = useState<string>('')

  useEffect(() => {
    loadEmployees()
    loadTemplates()
  }, [loadEmployees, loadTemplates])

  const activeEmployees = employees.filter((e) => e.active)
  const selectedEmp = activeEmployees.find((e) => e.id === selectedEmployee)

  async function loadConstraints(empId: string) {
    setLoading(true)
    try {
      const [ua, ms, ca] = await Promise.all([
        fetchUnavailabilities(empId),
        fetchManagerSchedules(empId),
        fetchConditionalAvailabilities(empId),
      ])
      setUnavailabilities(ua)
      setManagerSchedules(ms)
      setConditionals(ca)
    } catch {
      // silently fail if no connection
    }
    setLoading(false)
  }

  function handleSelectEmployee(empId: string) {
    setSelectedEmployee(empId)
    if (empId) loadConstraints(empId)
  }

  function toggleDay(day: number, list: number[], setList: (v: number[]) => void) {
    setList(list.includes(day) ? list.filter((d) => d !== day) : [...list, day])
  }

  function toggleShiftCode(code: string) {
    setCondShiftCodes(
      condShiftCodes.includes(code)
        ? condShiftCodes.filter((c) => c !== code)
        : [...condShiftCodes, code],
    )
  }

  // --- Unavailabilities ---

  async function handleAddUnavailability() {
    if (!selectedEmployee) return
    if (newType === 'fixed' && newDays.length === 0) return
    if (newType === 'punctual' && newDates.filter(Boolean).length === 0) return

    const created: Unavailability[] = []

    if (newType === 'fixed') {
      for (const day of newDays) {
        const u = await createUnavailability({
          employeeId: selectedEmployee,
          type: 'fixed',
          dayOfWeek: day,
          specificDate: null,
          availableFrom: null,
          availableUntil: null,
          label: newLabel || `OFF ${DAY_NAMES[day]}`,
        })
        created.push(u)
      }
    } else {
      for (const date of newDates.filter(Boolean)) {
        const u = await createUnavailability({
          employeeId: selectedEmployee,
          type: 'punctual',
          dayOfWeek: null,
          specificDate: date,
          availableFrom: null,
          availableUntil: null,
          label: newLabel || `OFF ${date}`,
        })
        created.push(u)
      }
    }

    setUnavailabilities([...unavailabilities, ...created])
    setNewDays([])
    setNewDates([''])
    setNewLabel('')
  }

  async function handleDeleteUnavailability(id: string) {
    await deleteUnavailability(id)
    setUnavailabilities(unavailabilities.filter((u) => u.id !== id))
  }

  // --- Conditional Availabilities ---

  async function handleAddConditional() {
    if (!selectedEmployee || condDays.length === 0 || condShiftCodes.length === 0) return

    const created: ConditionalAvailability[] = []
    for (const day of condDays) {
      const ca = await createConditionalAvailability({
        employeeId: selectedEmployee,
        dayOfWeek: day,
        allowedShiftCodes: condShiftCodes,
        maxHours: condMaxHours ? Number(condMaxHours) : null,
      })
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

  // --- Manager schedules ---

  async function handleSaveManagerSchedule(dayOfWeek: number, shiftTemplateId: string | null, startTime: number | null, endTime: number | null) {
    if (!selectedEmployee) return
    const saved = await upsertManagerSchedule({
      employeeId: selectedEmployee,
      dayOfWeek,
      shiftTemplateId,
      startTime,
      endTime,
    })
    setManagerSchedules([
      ...managerSchedules.filter((s) => s.dayOfWeek !== dayOfWeek),
      saved,
    ])
  }

  // Unique shift codes from templates
  const shiftOptions = templates.map((t) => ({ code: t.code, label: `${t.startTime}h → ${t.endTime}h` }))
  const uniqueShiftOptions = shiftOptions.filter((s, i, arr) => arr.findIndex((a) => a.code === s.code) === i)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Contraintes & Disponibilités</h1>

      {/* Sélection employé */}
      <Card>
        <CardContent className="pt-6">
          <Select
            id="employee"
            label="Sélectionner un salarié"
            value={selectedEmployee}
            onChange={(e) => handleSelectEmployee(e.target.value)}
            options={[
              { value: '', label: '— Choisir un salarié —' },
              ...activeEmployees.map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}${e.isManager ? ' (Manager)' : ''}`,
              })),
            ]}
          />
        </CardContent>
      </Card>

      {selectedEmployee && loading && <p className="text-muted-foreground">Chargement...</p>}

      {/* Horaires fixes manager */}
      {selectedEmp?.isManager && selectedEmployee && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Horaires fixes (Manager)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Les managers ont des horaires fixes chaque semaine.
            </p>
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
                    return (
                      <ManagerDayRow
                        key={day}
                        day={day}
                        dayName={DAY_NAMES[day]}
                        schedule={schedule ?? null}
                        templates={templates}
                        onSave={(templateId, start, end) => handleSaveManagerSchedule(day, templateId, start, end)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indisponibilités */}
      {selectedEmployee && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Indisponibilités (jours OFF)</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Liste existante */}
            {unavailabilities.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {unavailabilities.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div>
                      <span className={`mr-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.type === 'fixed' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                        {u.type === 'fixed' ? 'Récurrent' : 'Ponctuel'}
                      </span>
                      <span className="text-sm">
                        {u.type === 'fixed' && u.dayOfWeek != null
                          ? `Chaque ${DAY_NAMES[u.dayOfWeek]}`
                          : u.specificDate && new Date(u.specificDate).toLocaleDateString('fr-FR')}
                      </span>
                      {u.label && <span className="ml-2 text-sm text-muted-foreground">— {u.label}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteUnavailability(u.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire ajout */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-3 flex gap-3">
                <Select
                  id="newType"
                  label="Type"
                  value={newType}
                  onChange={(e) => { setNewType(e.target.value as 'fixed' | 'punctual'); setNewDays([]); setNewDates(['']) }}
                  options={[
                    { value: 'fixed', label: 'Récurrent (chaque semaine)' },
                    { value: 'punctual', label: 'Ponctuel (dates précises)' },
                  ]}
                />
                <Input
                  id="newLabel"
                  label="Motif (optionnel)"
                  placeholder="ex: Cours du soir"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>

              {newType === 'fixed' ? (
                <div className="mb-3">
                  <label className="mb-2 block text-sm font-medium">Jours (cochez plusieurs)</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => toggleDay(i, newDays, setNewDays)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          newDays.includes(i)
                            ? 'bg-warning text-white'
                            : 'bg-background border border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        {DAY_SHORT[i]}
                      </button>
                    ))}
                  </div>
                  {newDays.length > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {newDays.length} jour{newDays.length > 1 ? 's' : ''} sélectionné{newDays.length > 1 ? 's' : ''} : {newDays.sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-3">
                  <label className="mb-2 block text-sm font-medium">Dates</label>
                  <div className="flex flex-col gap-2">
                    {newDates.map((date, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => {
                            const updated = [...newDates]
                            updated[i] = e.target.value
                            setNewDates(updated)
                          }}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        />
                        {newDates.length > 1 && (
                          <button
                            onClick={() => setNewDates(newDates.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setNewDates([...newDates, ''])}
                      className="self-start text-sm text-primary hover:underline"
                    >
                      + Ajouter une date
                    </button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleAddUnavailability}
                size="sm"
                disabled={newType === 'fixed' ? newDays.length === 0 : newDates.filter(Boolean).length === 0}
              >
                <Plus size={16} className="mr-1" /> Ajouter {newType === 'fixed' && newDays.length > 1 ? `(${newDays.length} jours)` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disponibilités restreintes (horaires limités) */}
      {selectedEmployee && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={18} />
              Disponibilités restreintes (horaires limités)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Pour les salariés disponibles uniquement sur certains créneaux (ex: étudiants disponibles seulement le soir en semaine).
            </p>

            {/* Liste existante */}
            {conditionals.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {conditionals.map((ca) => (
                  <div key={ca.id} className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{DAY_NAMES[ca.dayOfWeek]}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="text-blue-700">
                        Créneaux autorisés : {ca.allowedShiftCodes.join(', ')}
                      </span>
                      {ca.maxHours && (
                        <span className="ml-2 text-muted-foreground">(max {ca.maxHours}h)</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteConditional(ca.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire ajout */}
            <div className="rounded-lg bg-blue-50/50 p-4">
              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium">Jours concernés (cochez plusieurs)</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i, condDays, setCondDays)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        condDays.includes(i)
                          ? 'bg-blue-600 text-white'
                          : 'bg-background border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {DAY_SHORT[i]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setCondDays([0, 1, 2, 3, 4])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Lun→Ven
                  </button>
                  <button
                    onClick={() => setCondDays([5, 6])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Sam+Dim
                  </button>
                  <button
                    onClick={() => setCondDays([0, 1, 2, 3, 4, 5, 6])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setCondDays([])}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Aucun
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium">Créneaux autorisés uniquement</label>
                <div className="flex flex-wrap gap-2">
                  {uniqueShiftOptions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => toggleShiftCode(s.code)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        condShiftCodes.includes(s.code)
                          ? 'bg-blue-600 text-white'
                          : 'bg-background border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ex: sélectionnez SOIR pour "disponible uniquement à partir de 18h"
                </p>
              </div>

              <div className="mb-3 w-48">
                <Input
                  id="condMaxHours"
                  label="Max heures/jour (optionnel)"
                  type="number"
                  min={0}
                  max={12}
                  step={0.5}
                  value={condMaxHours}
                  onChange={(e) => setCondMaxHours(e.target.value)}
                  placeholder="ex: 6"
                />
              </div>

              <Button
                onClick={handleAddConditional}
                size="sm"
                disabled={condDays.length === 0 || condShiftCodes.length === 0}
              >
                <Plus size={16} className="mr-1" />
                Ajouter {condDays.length > 1 ? `(${condDays.length} jours)` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- Manager Day Row sub-component ---

function ManagerDayRow({
  day,
  dayName,
  schedule,
  templates,
  onSave,
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
              // Auto-remplit Début/Fin avec les horaires du template choisi
              if (newId) {
                const tpl = templates.find((t) => t.id === newId)
                if (tpl) {
                  setStartTime(tpl.startTime)
                  setEndTime(tpl.endTime)
                }
              } else {
                // OFF sélectionné → on reset les heures
                setStartTime(null)
                setEndTime(null)
              }
            }}
            className="h-8 rounded border border-input bg-background px-2 text-sm"
          >
            <option value="">OFF</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} ({t.startTime}→{t.endTime})
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        {!isClosed && templateId && (
          <input
            type="number"
            step={0.5}
            min={0}
            max={24}
            value={startTime ?? ''}
            onChange={(e) => setStartTime(e.target.value ? Number(e.target.value) : null)}
            placeholder="auto"
            className="h-8 w-20 rounded border border-input bg-background px-2 text-sm"
          />
        )}
      </td>
      <td className="px-3 py-2">
        {!isClosed && templateId && (
          <input
            type="number"
            step={0.5}
            min={0}
            max={24}
            value={endTime ?? ''}
            onChange={(e) => setEndTime(e.target.value ? Number(e.target.value) : null)}
            placeholder="auto"
            className="h-8 w-20 rounded border border-input bg-background px-2 text-sm"
          />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!isClosed && (
          <button
            onClick={() => onSave(templateId || null, startTime, endTime)}
            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            title="Enregistrer"
          >
            <Save size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}
