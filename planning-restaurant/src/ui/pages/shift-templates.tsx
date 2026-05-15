import { useEffect, useState } from 'react'
import { useShiftTemplateStore } from '@/store/shift-template-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { TimeInput } from '@/ui/components/time-input'
import { freshQuery } from '@/infrastructure/supabase/fresh-query'
import { DEFAULT_SHIFTS_HCR } from '@/domain/models/shift'
import type { ShiftTemplate, ShiftCategory, DayApplicability } from '@/domain/models/shift'
import { Plus, Trash2, Zap, Pencil } from 'lucide-react'

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
const DEPARTMENT_OPTIONS = [
  { value: 'salle', label: 'Salle' },
  { value: 'cuisine', label: 'Cuisine' },
]

function formatDecimalTime(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`
}

export function ShiftTemplatesPage() {
  const { templates, loading, load, add, update, remove } = useShiftTemplateStore()
  const { tenantId } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ShiftCategory>('midi')
  const [startTime, setStartTime] = useState(11)
  const [endTime, setEndTime] = useState(15)
  const [effectiveHours, setEffectiveHours] = useState(4)
  const [meals, setMeals] = useState(0)
  const [baskets, setBaskets] = useState(0)
  const [applicability, setApplicability] = useState<DayApplicability>('tue_sat')
  const [department, setDepartment] = useState<'salle' | 'cuisine'>('salle')

  useEffect(() => { load() }, [load])

  function handleStartTimeChange(val: number) {
    setStartTime(val)
    if (endTime > val) setEffectiveHours(Math.round((endTime - val) * 10) / 10)
  }
  function handleEndTimeChange(val: number) {
    setEndTime(val)
    if (val > startTime) setEffectiveHours(Math.round((val - startTime) * 10) / 10)
  }

  function resetForm() {
    setCode(''); setLabel(''); setCategory('midi'); setStartTime(11); setEndTime(15)
    setEffectiveHours(4); setMeals(0); setBaskets(0); setApplicability('tue_sat')
    setDepartment('salle'); setEditingId(null)
  }

  function openAdd() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(t: ShiftTemplate) {
    setEditingId(t.id)
    setCode(t.code); setLabel(t.label); setCategory(t.category as ShiftCategory)
    setStartTime(t.startTime); setEndTime(t.endTime); setEffectiveHours(t.effectiveHours)
    setMeals(t.meals); setBaskets(t.baskets); setApplicability(t.applicability as DayApplicability)
    setDepartment(t.department as 'salle' | 'cuisine')
    setShowForm(true)
  }

  async function checkLinkedPlannings(templateId: string): Promise<number> {
    try {
      const data = await freshQuery((c) =>
        c.from('planning_entries').select('planning_id').eq('shift_template_id', templateId).limit(100),
      )
      const rows = (data as { planning_id: string }[]) ?? []
      const uniquePlannings = new Set(rows.map((r) => r.planning_id))
      return uniquePlannings.size
    } catch { return 0 }
  }

  async function deleteLinkedPlannings(templateId: string) {
    try {
      const data = await freshQuery((c) =>
        c.from('planning_entries').select('planning_id').eq('shift_template_id', templateId).limit(100),
      )
      const rows = (data as { planning_id: string }[]) ?? []
      const ids = [...new Set(rows.map((r) => r.planning_id))]
      for (const pid of ids) {
        await freshQuery((c) => c.from('planning_entries').delete().eq('planning_id', pid).select())
        await freshQuery((c) => c.from('plannings').delete().eq('id', pid).select())
      }
    } catch { /* best effort */ }
  }

  async function handleSave() {
    if (!tenantId || !code.trim() || !label.trim()) return

    if (editingId) {
      const count = await checkLinkedPlannings(editingId)
      if (count > 0) {
        const ok = confirm(
          `Ce créneau est utilisé dans ${count} planning(s) enregistré(s).\n\nModifier ce créneau supprimera ces plannings.\nVous pourrez les regénérer ensuite.\n\nContinuer ?`
        )
        if (!ok) return
        await deleteLinkedPlannings(editingId)
      }
      await update(editingId, {
        code: code.trim().toUpperCase(), label: label.trim(), category,
        startTime, endTime, effectiveHours, meals, baskets, applicability, department,
      })
    } else {
      await add({
        tenantId, code: code.trim().toUpperCase(), label: label.trim(), category,
        startTime, endTime, effectiveHours, meals, baskets, applicability,
        sortOrder: templates.length, department,
      })
    }
    setShowForm(false)
    resetForm()
  }

  async function handleDelete(t: ShiftTemplate) {
    const count = await checkLinkedPlannings(t.id)
    if (count > 0) {
      const ok = confirm(
        `Ce créneau est utilisé dans ${count} planning(s).\nSupprimer le créneau supprimera aussi ces plannings.\n\nContinuer ?`
      )
      if (!ok) return
      await deleteLinkedPlannings(t.id)
    } else {
      if (!confirm(`Supprimer "${t.code}" ?`)) return
    }
    await remove(t.id)
  }

  async function handleLoadDefaults() {
    if (!tenantId) return
    if (templates.length > 0 && !confirm('Cela va ajouter les créneaux HCR par défaut. Continuer ?')) return
    for (const shift of DEFAULT_SHIFTS_HCR) { await add({ ...shift, tenantId }) }
  }

  const groupedByDept = {
    salle: {
      tue_sat: templates.filter((t) => t.department === 'salle' && t.applicability === 'tue_sat'),
      sat_only: templates.filter((t) => t.department === 'salle' && t.applicability === 'sat_only'),
      sunday: templates.filter((t) => t.department === 'salle' && t.applicability === 'sunday'),
    },
    cuisine: {
      tue_sat: templates.filter((t) => t.department === 'cuisine' && t.applicability === 'tue_sat'),
      sat_only: templates.filter((t) => t.department === 'cuisine' && t.applicability === 'sat_only'),
      sunday: templates.filter((t) => t.department === 'cuisine' && t.applicability === 'sunday'),
    },
  }
  const totalSalle = templates.filter((t) => t.department === 'salle').length
  const totalCuisine = templates.filter((t) => t.department === 'cuisine').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Créneaux horaires ({templates.length})</h1>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="secondary" onClick={handleLoadDefaults}><Zap size={16} className="mr-2" /> Charger défauts HCR</Button>
          )}
          <Button onClick={openAdd}><Plus size={16} className="mr-2" /> Ajouter</Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Chargement...</p>}

      {(['salle', 'cuisine'] as const).map((dept) => {
        const groups = groupedByDept[dept]
        const total = dept === 'salle' ? totalSalle : totalCuisine
        if (total === 0) return null
        const isCuisine = dept === 'cuisine'
        return (
          <div key={dept} className="flex flex-col gap-3">
            <h2 className={`flex items-center gap-2 text-lg font-bold ${isCuisine ? 'text-amber-700' : 'text-blue-700'}`}>
              <span className={`inline-block h-3 w-3 rounded-full ${isCuisine ? 'bg-amber-500' : 'bg-blue-500'}`} />
              {dept === 'salle' ? 'Salle' : 'Cuisine'} ({total})
            </h2>
            {Object.entries(groups).map(([key, shifts]) =>
              shifts.length > 0 ? (
                <Card key={`${dept}-${key}`} className={isCuisine ? 'border-amber-200/60' : 'border-blue-200/60'}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {key === 'tue_sat' ? 'Mardi → Samedi' : key === 'sat_only' ? 'Samedi uniquement' : 'Dimanche'}
                    </CardTitle>
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
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
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
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEdit(t)}
                                    className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    title="Modifier"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(t)}
                                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
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
          </div>
        )
      })}

      {templates.length === 0 && !loading && (
        <Card>
          <CardHeader><CardTitle>Aucun créneau</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Chargez les créneaux par défaut HCR ou ajoutez les manuellement.</p></CardContent>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Modifier le créneau' : 'Ajouter un créneau'}</h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input id="code" label="Code" placeholder="SOIR" value={code} onChange={(e) => setCode(e.target.value)} required />
                <Input id="label" label="Libellé" placeholder="Soir" value={label} onChange={(e) => setLabel(e.target.value)} required />
              </div>
              <div>
                <Select id="department" label="Département" value={department} onChange={(e) => setDepartment(e.target.value as 'salle' | 'cuisine')} options={DEPARTMENT_OPTIONS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select id="category" label="Type" value={category} onChange={(e) => setCategory(e.target.value as ShiftCategory)} options={CATEGORY_OPTIONS} />
                <Select id="applicability" label="Jours" value={applicability} onChange={(e) => setApplicability(e.target.value as DayApplicability)} options={APPLICABILITY_OPTIONS} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <TimeInput label="Début" value={startTime} onChange={handleStartTimeChange} />
                <TimeInput label="Fin" value={endTime} onChange={handleEndTimeChange} />
                <Input id="effectiveHours" label="H. effectives" type="number" step={0.5} min={0} max={24} value={effectiveHours} onChange={(e) => setEffectiveHours(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="meals" label="Repas" type="number" min={0} max={3} value={meals} onChange={(e) => setMeals(Number(e.target.value))} />
                <Input id="baskets" label="Paniers" type="number" min={0} max={3} value={baskets} onChange={(e) => setBaskets(Number(e.target.value))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} className="flex-1" disabled={!code.trim() || !label.trim()}>
                  {editingId ? 'Sauvegarder' : 'Ajouter'}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Annuler</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
