import { useEffect, useState } from 'react'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { DEFAULT_SHIFTS_HCR } from '@/domain/models/shift'
import type { ShiftCategory, DayApplicability } from '@/domain/models/shift'
import { Plus, Trash2, Zap } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'ouverture', label: 'Ouverture' },
  { value: 'midi', label: 'Midi' },
  { value: 'midi_long', label: 'Midi long' },
  { value: 'journee', label: 'Journée' },
  { value: 'fermeture', label: 'Fermeture' },
  { value: 'soir', label: 'Soir' },
  { value: 'renfort', label: 'Renfort' },
]

const APPLICABILITY_OPTIONS = [
  { value: 'tue_sat', label: 'Mardi → Samedi' },
  { value: 'sat_only', label: 'Samedi uniquement' },
  { value: 'sunday', label: 'Dimanche' },
]


function formatDecimalTime(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`
}

export function ShiftTemplatesPage() {
  const { templates, loading, load, add, remove } = useShiftTemplateStore()
  const { tenantId } = useAuthStore()
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ShiftCategory>('midi')
  const [startTime, setStartTime] = useState(11)
  const [endTime, setEndTime] = useState(15)
  const [effectiveHours, setEffectiveHours] = useState(4)
  const [meals, setMeals] = useState(0)
  const [baskets, setBaskets] = useState(0)
  const [applicability, setApplicability] = useState<DayApplicability>('tue_sat')

  useEffect(() => {
    load()
  }, [load])

  // Auto-calculate effective hours when changing start/end in form
  function handleStartTimeChange(val: number) {
    setStartTime(val)
    if (endTime > val) setEffectiveHours(endTime - val)
  }

  function handleEndTimeChange(val: number) {
    setEndTime(val)
    if (val > startTime) setEffectiveHours(val - startTime)
  }

  async function handleLoadDefaults() {
    if (!tenantId) return
    if (templates.length > 0 && !confirm('Cela va ajouter les créneaux HCR par défaut. Continuer ?')) return

    for (const shift of DEFAULT_SHIFTS_HCR) {
      await add({ ...shift, tenantId })
    }
  }

  function handleAdd() {
    if (!tenantId || !code.trim() || !label.trim()) return
    add({
      tenantId,
      code: code.trim().toUpperCase(),
      label: label.trim(),
      category,
      startTime,
      endTime,
      effectiveHours,
      meals,
      baskets,
      applicability,
      sortOrder: templates.length,
    })
    setShowAddForm(false)
    resetForm()
  }

  function resetForm() {
    setCode('')
    setLabel('')
    setCategory('midi')
    setStartTime(11)
    setEndTime(15)
    setEffectiveHours(4)
    setMeals(0)
    setBaskets(0)
    setApplicability('tue_sat')
  }

  // Group templates by applicability
  const grouped = {
    tue_sat: templates.filter((t) => t.applicability === 'tue_sat'),
    sat_only: templates.filter((t) => t.applicability === 'sat_only'),
    sunday: templates.filter((t) => t.applicability === 'sunday'),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Créneaux horaires ({templates.length})</h1>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="secondary" onClick={handleLoadDefaults}>
              <Zap size={16} className="mr-2" /> Charger défauts HCR
            </Button>
          )}
          <Button onClick={() => setShowAddForm(true)}>
            <Plus size={16} className="mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Chargement...</p>}

      {/* Tables par groupe */}
      {Object.entries(grouped).map(([key, shifts]) =>
        shifts.length > 0 ? (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{key === 'tue_sat' ? 'Mardi → Samedi' : key === 'sat_only' ? 'Samedi uniquement' : 'Dimanche'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Libellé</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Début</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Fin</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">H.eff</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Repas</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Paniers</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((t) => (
                      <tr key={t.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs font-bold">{t.code}</td>
                        <td className="px-3 py-2">{t.label}</td>
                        <td className="px-3 py-2 capitalize">{t.category}</td>
                        <td className="px-3 py-2 text-center">{formatDecimalTime(t.startTime)}</td>
                        <td className="px-3 py-2 text-center">{formatDecimalTime(t.endTime)}</td>
                        <td className="px-3 py-2 text-center font-bold">{t.effectiveHours}h</td>
                        <td className="px-3 py-2 text-center">{t.meals}</td>
                        <td className="px-3 py-2 text-center">{t.baskets}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => { if (confirm(`Supprimer "${t.code}" ?`)) remove(t.id) }}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null,
      )}

      {templates.length === 0 && !loading && (
        <Card>
          <CardHeader><CardTitle>Aucun créneau</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Chargez les créneaux par défaut HCR ou ajoutez les manuellement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal ajout */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Ajouter un créneau</h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input id="code" label="Code" placeholder="SOIR" value={code} onChange={(e) => setCode(e.target.value)} required />
                <Input id="label" label="Libellé" placeholder="Soir" value={label} onChange={(e) => setLabel(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select id="category" label="Type" value={category} onChange={(e) => setCategory(e.target.value as ShiftCategory)} options={CATEGORY_OPTIONS} />
                <Select id="applicability" label="Jours" value={applicability} onChange={(e) => setApplicability(e.target.value as DayApplicability)} options={APPLICABILITY_OPTIONS} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input id="startTime" label="Début (décimal)" type="number" step={0.5} min={0} max={24} value={startTime} onChange={(e) => handleStartTimeChange(Number(e.target.value))} />
                <Input id="endTime" label="Fin (décimal)" type="number" step={0.5} min={0} max={24} value={endTime} onChange={(e) => handleEndTimeChange(Number(e.target.value))} />
                <Input id="effectiveHours" label="H. effectives" type="number" step={0.5} min={0} max={24} value={effectiveHours} onChange={(e) => setEffectiveHours(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="meals" label="Repas" type="number" min={0} max={3} value={meals} onChange={(e) => setMeals(Number(e.target.value))} />
                <Input id="baskets" label="Paniers" type="number" min={0} max={3} value={baskets} onChange={(e) => setBaskets(Number(e.target.value))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleAdd} className="flex-1" disabled={!code.trim() || !label.trim()}>Ajouter</Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); resetForm() }}>Annuler</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
