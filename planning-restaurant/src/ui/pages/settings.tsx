import { useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/ui/components'
import { TimeInput } from '@/ui/components/time-input'
import { useAuthStore } from '@/store/auth-store'
import { useTenantStore } from '@/store/tenant-store'
import { useEmployeeStore } from '@/store/employee-store'
import type { TenantRules } from '@/domain/models/tenant'
import { DEFAULT_TENANT_RULES } from '@/domain/models/tenant'
import { uploadTenantLogo } from '@/infrastructure/supabase/repositories/tenant-repo'
import { Save, CheckCircle, Settings as SettingsIcon, Utensils, Users, ChefHat, Upload, Image as ImageIcon, X } from 'lucide-react'

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function SettingsPage() {
  const { tenantId } = useAuthStore()
  const { tenant, load, update, updateRules } = useTenantStore()
  const { employees, load: loadEmployees } = useEmployeeStore()

  const [rules, setRules] = useState<TenantRules>(DEFAULT_TENANT_RULES)
  const [restaurantName, setRestaurantName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [openingTime, setOpeningTime] = useState(9.5)
  const [closingTimeWeek, setClosingTimeWeek] = useState(24.0)
  const [closingTimeSunday, setClosingTimeSunday] = useState(21.0)
  const [productivityTarget, setProductivityTarget] = useState(95)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tenantId) load(tenantId)
    loadEmployees()
  }, [tenantId, load, loadEmployees])

  useEffect(() => {
    if (tenant) {
      setRules(tenant.rules)
      setRestaurantName(tenant.name)
      setLogoUrl(tenant.logoUrl)
      setOpeningTime(tenant.openingTime)
      setClosingTimeWeek(tenant.closingTimeWeek)
      setClosingTimeSunday(tenant.closingTimeSunday)
      setProductivityTarget(tenant.productivityTarget)
    }
  }, [tenant])

  const kitchenEmployees = employees.filter((e) => e.active && e.department === 'cuisine')

  async function handleSave() {
    if (!tenantId) return
    setSaving(true)
    setSaved(false)
    try {
      await update(tenantId, {
        name: restaurantName,
        logoUrl,
        openingTime,
        closingTimeWeek,
        closingTimeSunday,
        productivityTarget,
        rules,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Fichier trop volumineux (max 2 Mo)')
      return
    }
    if (!file.type.startsWith('image/')) {
      setLogoError("Format non supporté (images uniquement)")
      return
    }
    setLogoError('')
    setUploadingLogo(true)
    try {
      const url = await uploadTenantLogo(tenantId, file)
      setLogoUrl(url)
      await update(tenantId, { logoUrl: url })
    } catch (err) {
      setLogoError((err as Error).message)
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  async function handleLogoRemove() {
    if (!tenantId) return
    setLogoUrl(null)
    await update(tenantId, { logoUrl: null })
  }

  async function handleSaveRulesOnly() {
    if (!tenantId) return
    setSaving(true)
    setSaved(false)
    try {
      await updateRules(tenantId, rules)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function togglePrepTeamMember(empId: string) {
    setRules((r) => ({
      ...r,
      kitchenPrepTeam: r.kitchenPrepTeam.includes(empId)
        ? r.kitchenPrepTeam.filter((id) => id !== empId)
        : [...r.kitchenPrepTeam, empId],
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saved ? <CheckCircle size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
          {saved ? 'Enregistré' : saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {/* Restaurant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Utensils size={15} className="text-slate-600" />
            </div>
            Restaurant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-start gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon size={28} className="text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Logo du restaurant</label>
              <p className="mb-2 text-xs text-muted-foreground">
                PNG, JPG ou SVG. Max 2 Mo. Affiché dans la barre latérale.
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Upload size={14} />
                  {uploadingLogo ? 'Envoi…' : logoUrl ? 'Changer' : 'Envoyer un logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <X size={14} /> Retirer
                  </button>
                )}
              </div>
              {logoError && <p className="mt-1 text-xs text-red-500">{logoError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nom</label>
              <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
            </div>
            <TimeInput label="Ouverture" value={openingTime} onChange={setOpeningTime} />
            <TimeInput label="Fermeture semaine" value={closingTimeWeek} onChange={setClosingTimeWeek} />
            <TimeInput label="Fermeture dimanche" value={closingTimeSunday} onChange={setClosingTimeSunday} />
            <div>
              <label className="mb-1 block text-sm font-medium">Productivité cible (€/h)</label>
              <Input
                type="number"
                step="1"
                min="50"
                max="200"
                value={productivityTarget}
                onChange={(e) => setProductivityTarget(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Règles générales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <SettingsIcon size={15} className="text-slate-600" />
            </div>
            Règles générales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Repos min entre jours (h)</label>
              <Input
                type="number"
                min="8"
                max="14"
                value={rules.minRestHours}
                onChange={(e) => setRules({ ...rules, minRestHours: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max jours / semaine</label>
              <Input
                type="number"
                min="3"
                max="6"
                value={rules.maxWorkingDays}
                onChange={(e) => setRules({ ...rules, maxWorkingDays: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Seuil temps plein (h/sem)</label>
              <Input
                type="number"
                min="30"
                max="40"
                value={rules.fulltimeThreshold}
                onChange={(e) => setRules({ ...rules, fulltimeThreshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Seuil productivité bas</label>
              <Input
                type="number"
                min="50"
                max="100"
                value={rules.productivityLowerThreshold}
                onChange={(e) => setRules({ ...rules, productivityLowerThreshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Seuil productivité haut</label>
              <Input
                type="number"
                min="100"
                max="200"
                value={rules.productivityUpperThreshold}
                onChange={(e) => setRules({ ...rules, productivityUpperThreshold: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Règles Salle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Users size={15} className="text-blue-600" />
            </div>
            Règles Salle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Min fermeture semaine</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={rules.minClosingWeekday}
                onChange={(e) => setRules({ ...rules, minClosingWeekday: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Nb personnes à la fermeture jours de semaine</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Min fermeture weekend</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={rules.minClosingWeekend}
                onChange={(e) => setRules({ ...rules, minClosingWeekend: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Nb personnes à la fermeture weekend</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Début weekend</label>
              <Select
                value={String(rules.weekendStartDay)}
                onChange={(e) => setRules({ ...rules, weekendStartDay: Number(e.target.value) })}
                options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">À partir de ce jour, règles weekend</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Règles Cuisine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <ChefHat size={15} className="text-amber-600" />
            </div>
            Règles Cuisine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Min cuisiniers midi</label>
              <Input
                type="number"
                min="0"
                max="6"
                value={rules.minKitchenMidi}
                onChange={(e) => setRules({ ...rules, minKitchenMidi: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Jour de préparation</label>
              <Select
                value={rules.kitchenPrepDay === null ? '' : String(rules.kitchenPrepDay)}
                onChange={(e) => setRules({
                  ...rules,
                  kitchenPrepDay: e.target.value === '' ? null : Number(e.target.value),
                })}
                options={[
                  { value: '', label: 'Aucun' },
                  ...DAY_NAMES.map((d, i) => ({ value: String(i), label: d })),
                ]}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={rules.kitchenClosedSundayEvening}
                  onChange={(e) => setRules({ ...rules, kitchenClosedSundayEvening: e.target.checked })}
                />
                Dimanche soir fermé
              </label>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Équipe préparation (cuisiniers présents le matin du jour de prep)</label>
            {kitchenEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun cuisinier actif. Ajoutez-en depuis l'onglet Salariés.</p>
            )}
            {kitchenEmployees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {kitchenEmployees.map((emp) => {
                  const selected = rules.kitchenPrepTeam.includes(emp.id)
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => togglePrepTeamMember(emp.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        selected
                          ? 'border-amber-500 bg-amber-100 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {emp.firstName} {emp.lastName}
                      {selected && <span className="ml-1">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={handleSaveRulesOnly} disabled={saving}>
              <Save size={14} className="mr-2" /> Enregistrer les règles
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Affichage du planning */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SettingsIcon size={18} /> Affichage du planning</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Toggle pastilles rôle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="showRoleBadges" className="text-sm font-medium">Afficher les pastilles de rôle dans le décompte</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quand désactivé, le tableau de décompte n'affiche que le nombre total de personnes par créneau, sans détail par rôle.
              </p>
            </div>
            <button
              type="button"
              id="showRoleBadges"
              onClick={() => setRules((r) => ({ ...r, planningShowRoleBadges: !r.planningShowRoleBadges }))}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rules.planningShowRoleBadges ? 'bg-success' : 'bg-border'}`}
              aria-label="Afficher les pastilles de rôle"
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${rules.planningShowRoleBadges ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Créneaux de décompte */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Créneaux du tableau de décompte</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chaque ligne est une colonne dans le tableau. Point unique : mettez la même heure de début et de fin (ex: 9h30 - 9h30).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRules((r) => ({ ...r, planningServiceSlots: [
                  ...r.planningServiceSlots,
                  { key: `slot_${Date.now()}`, label: 'Nouveau créneau', startTime: 12, endTime: 14 },
                ]}))}
              >+ Ajouter un créneau</Button>
            </div>
            <div className="flex flex-col gap-2">
              {rules.planningServiceSlots.map((slot, idx) => {
                const patch = (changes: Partial<typeof slot>) => setRules((r) => ({
                  ...r,
                  planningServiceSlots: r.planningServiceSlots.map((s, i) => i === idx ? { ...s, ...changes } : s),
                }))
                return (
                <div key={slot.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        id={`slot-label-${idx}`}
                        label="Libellé"
                        value={slot.label}
                        onChange={(e) => patch({ label: e.target.value })}
                      />
                    </div>
                    <div className="w-28">
                      {slot.startAtClosing ? (
                        <Input
                          id={`slot-start-off-${idx}`}
                          label="Début (déc. h)"
                          type="number"
                          step={0.5}
                          value={slot.startTime}
                          onChange={(e) => patch({ startTime: Number(e.target.value) })}
                        />
                      ) : (
                        <TimeInput label="Début" value={slot.startTime} onChange={(v) => patch({ startTime: v })} />
                      )}
                    </div>
                    <div className="w-28">
                      {slot.endAtClosing ? (
                        <Input
                          id={`slot-end-off-${idx}`}
                          label="Fin (déc. h)"
                          type="number"
                          step={0.5}
                          value={slot.endTime}
                          onChange={(e) => patch({ endTime: Number(e.target.value) })}
                        />
                      ) : (
                        <TimeInput label="Fin" value={slot.endTime} onChange={(v) => patch({ endTime: v })} />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRules((r) => ({
                        ...r,
                        planningServiceSlots: r.planningServiceSlots.filter((_, i) => i !== idx),
                      }))}
                      className="mb-1 rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer ce créneau"
                      aria-label="Supprimer ce créneau"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 pl-1">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!slot.startAtClosing}
                        onChange={(e) => patch({ startAtClosing: e.target.checked, startTime: e.target.checked ? 0 : 9 })}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      Début = fermeture du jour
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!slot.endAtClosing}
                        onChange={(e) => patch({ endAtClosing: e.target.checked, endTime: e.target.checked ? 0 : 18 })}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      Fin = fermeture du jour
                    </label>
                  </div>
                </div>
                )
              })}
              {rules.planningServiceSlots.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Aucun créneau — le tableau de décompte sera vide.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              « = fermeture du jour » adapte automatiquement le créneau à l'heure de fermeture réelle (23h en semaine, 21h le dimanche, selon tes réglages plus haut). Le décalage permet d'aller au-delà : ex. décalage +1 = 1h après la fermeture.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleSaveRulesOnly} disabled={saving}>
              <Save size={14} className="mr-2" /> Enregistrer l'affichage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
