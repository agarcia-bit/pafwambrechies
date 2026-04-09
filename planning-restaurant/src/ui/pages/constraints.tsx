import { useEffect, useState } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { Button, Select, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import type { Unavailability, ManagerFixedSchedule } from '@/domain/models/constraint'
import {
  fetchUnavailabilities,
  createUnavailability,
  deleteUnavailability,
  fetchManagerSchedules,
  upsertManagerSchedule,
} from '@/infrastructure/supabase/repositories/constraint-repo'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { Plus, Trash2, Save } from 'lucide-react'

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function ConstraintsPage() {
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { templates, load: loadTemplates } = useShiftTemplateStore()
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([])
  const [managerSchedules, setManagerSchedules] = useState<ManagerFixedSchedule[]>([])
  const [loading, setLoading] = useState(false)

  // Form state for new unavailability
  const [newType, setNewType] = useState<'fixed' | 'punctual'>('fixed')
  const [newDay, setNewDay] = useState(1) // mardi par défaut
  const [newDate, setNewDate] = useState('')
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    loadEmployees()
    loadTemplates()
  }, [loadEmployees, loadTemplates])

  const activeEmployees = employees.filter((e) => e.active)
  const selectedEmp = activeEmployees.find((e) => e.id === selectedEmployee)

  async function loadConstraints(empId: string) {
    setLoading(true)
    try {
      const [ua, ms] = await Promise.all([
        fetchUnavailabilities(empId),
        fetchManagerSchedules(empId),
      ])
      setUnavailabilities(ua)
      setManagerSchedules(ms)
    } catch {
      // silently fail if no connection
    }
    setLoading(false)
  }

  function handleSelectEmployee(empId: string) {
    setSelectedEmployee(empId)
    if (empId) loadConstraints(empId)
  }

  async function handleAddUnavailability() {
    if (!selectedEmployee) return
    const u = await createUnavailability({
      employeeId: selectedEmployee,
      type: newType,
      dayOfWeek: newType === 'fixed' ? newDay : null,
      specificDate: newType === 'punctual' ? newDate : null,
      label: newLabel || (newType === 'fixed' ? `OFF ${DAY_NAMES[newDay]}` : `OFF ${newDate}`),
    })
    setUnavailabilities([...unavailabilities, u])
    setNewLabel('')
  }

  async function handleDeleteUnavailability(id: string) {
    await deleteUnavailability(id)
    setUnavailabilities(unavailabilities.filter((u) => u.id !== id))
  }

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
              Les managers ont des horaires fixes chaque semaine. Sélectionnez OFF ou un créneau pour chaque jour.
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
            <CardTitle>Indisponibilités</CardTitle>
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
                          : u.specificDate}
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
            <div className="flex items-end gap-3 rounded-lg bg-muted/50 p-4">
              <Select
                id="newType"
                label="Type"
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'fixed' | 'punctual')}
                options={[
                  { value: 'fixed', label: 'Récurrent (chaque semaine)' },
                  { value: 'punctual', label: 'Ponctuel (date précise)' },
                ]}
              />
              {newType === 'fixed' ? (
                <Select
                  id="newDay"
                  label="Jour"
                  value={String(newDay)}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  options={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              )}
              <Button onClick={handleAddUnavailability} size="sm">
                <Plus size={16} className="mr-1" /> Ajouter
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

  const isClosed = day === 0 // Lundi fermé

  return (
    <tr className={`border-b border-border ${isClosed ? 'bg-planning-off/30' : ''}`}>
      <td className="px-3 py-2 font-medium">{dayName}</td>
      <td className="px-3 py-2">
        {isClosed ? (
          <span className="text-sm text-muted-foreground">Fermé</span>
        ) : (
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
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
