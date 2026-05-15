import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/ui/components'
import { useEmployeeStore } from '@/store/employee-store'
import { useForecastStore } from '@/store/forecast-store'
import { useAuthStore } from '@/store/auth-store'
import { useEffect, useMemo, useState } from 'react'
import { fetchPlannings, updatePlanningStatus, deletePlanning, fetchMonthlyHours } from '@/infrastructure/supabase/repositories/planning-repo'
import type { SavedPlanning, MonthlyHours } from '@/infrastructure/supabase/repositories/planning-repo'
import { fetchMonthlyActuals, upsertMonthlyActual, type MonthlyActual } from '@/infrastructure/supabase/repositories/monthly-actual-repo'
import { CheckCircle, Clock, Trash2, FileSpreadsheet, Users, Euro, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-warning/10 text-warning' },
  validated: { label: 'Validé', color: 'bg-success/10 text-success' },
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function getCurrentMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function DashboardPage({ onViewPlanning }: { onViewPlanning?: (id: string, department?: string) => void }) {
  const { employees, load } = useEmployeeStore()
  const { forecasts, load: loadForecasts } = useForecastStore()
  const { tenantId } = useAuthStore()
  const [plannings, setPlannings] = useState<SavedPlanning[]>([])
  const [loadingPlannings, setLoadingPlannings] = useState(true)

  // Monthly tracking
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [monthlyHours, setMonthlyHours] = useState<MonthlyHours[]>([])
  const [monthlyActuals, setMonthlyActuals] = useState<MonthlyActual[]>([])
  const [editingMonth, setEditingMonth] = useState<number | null>(null)
  const [editingCA, setEditingCA] = useState('')

  function refreshPlannings() {
    setLoadingPlannings(true)
    fetchPlannings()
      .then(setPlannings)
      .catch((e: unknown) => console.warn('[dashboard]', e))
      .finally(() => setLoadingPlannings(false))
  }

  useEffect(() => {
    load()
    loadForecasts()
    setLoadingPlannings(true)
    fetchPlannings()
      .then(setPlannings)
      .catch((e: unknown) => console.warn('[dashboard]', e))
      .finally(() => setLoadingPlannings(false))
  }, [load, loadForecasts])

  // Load monthly data when year changes
  useEffect(() => {
    fetchMonthlyHours(selectedYear).then(setMonthlyHours).catch((e: unknown) => console.warn('[dashboard]', e))
    fetchMonthlyActuals(selectedYear).then(setMonthlyActuals).catch((e: unknown) => console.warn('[dashboard]', e))
  }, [selectedYear])

  const activeEmployees = employees.filter((e) => e.active)

  const totalWeeklyHours = useMemo(
    () => activeEmployees.reduce((sum, e) => sum + (e.weeklyHours ?? 0), 0),
    [activeEmployees],
  )
  const salleWeeklyHours = useMemo(
    () => activeEmployees.filter((e) => e.department === 'salle').reduce((s, e) => s + (e.weeklyHours ?? 0), 0),
    [activeEmployees],
  )
  const cuisineWeeklyHours = useMemo(
    () => activeEmployees.filter((e) => e.department === 'cuisine').reduce((s, e) => s + (e.weeklyHours ?? 0), 0),
    [activeEmployees],
  )

  const weeklyForecastRevenue = useMemo(() => {
    const monday = getCurrentMonday()
    let total = 0
    for (let day = 1; day <= 6; day++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + day)
      const month = date.getMonth() + 1
      const f = forecasts.find((fc) => fc.month === month && fc.dayOfWeek === day)
      total += f?.forecastedRevenue ?? 0
    }
    return total
  }, [forecasts])

  // Monthly data for display
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const hours = monthlyHours.find((h) => h.month === month)?.totalHours ?? 0
      const actual = monthlyActuals.find((a) => a.month === month)
      const ca = actual?.actualRevenue ?? null
      const productivity = hours > 0 && ca != null ? Math.round(ca / hours) : null
      return { month, name: MONTH_NAMES[i], short: MONTH_SHORT[i], hours, ca, productivity }
    })
  }, [monthlyHours, monthlyActuals])

  // Chart data (only months with both hours and CA)
  const chartData = useMemo(() =>
    monthlyData
      .filter((d) => d.hours > 0 && d.ca != null)
      .map((d) => ({ name: d.short, productivité: d.productivity })),
  [monthlyData])

  async function handleSaveCA(month: number) {
    if (!tenantId || !editingCA) return
    await upsertMonthlyActual(tenantId, selectedYear, month, Number(editingCA))
    fetchMonthlyActuals(selectedYear).then(setMonthlyActuals).catch((e: unknown) => console.warn('[dashboard]', e))
    setEditingMonth(null)
    setEditingCA('')
  }

  async function handleValidate(id: string) {
    await updatePlanningStatus(id, 'validated')
    refreshPlannings()
  }

  async function handleDelete(p: SavedPlanning) {
    if (confirm(`Supprimer le planning semaine ${p.weekNumber} ?`)) {
      await deletePlanning(p.id)
      refreshPlannings()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full bg-indigo-500/10" />
          <CardContent className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <Users size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Salariés actifs</p>
                <p className="text-2xl font-bold text-slate-900">{activeEmployees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full bg-emerald-500/10" />
          <CardContent className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Clock size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Volume d'heures disponibles</p>
                <p className="text-2xl font-bold text-slate-900">
                  {totalWeeklyHours}
                  <span className="ml-1 text-sm font-medium text-slate-500">h / sem</span>
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Salle {salleWeeklyHours}h · Cuisine {cuisineWeeklyHours}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-4 translate-x-4 rounded-full bg-amber-500/10" />
          <CardContent className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Euro size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">CA prévu cette semaine</p>
                <p className="text-2xl font-bold text-slate-900">
                  {weeklyForecastRevenue.toLocaleString('fr-FR')}
                  <span className="ml-1 text-sm font-medium text-slate-500">€</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suivi mensuel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                <TrendingUp size={15} className="text-indigo-600" />
              </div>
              Suivi annuel : Productivité Salle
            </CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedYear(selectedYear - 1)} className="rounded p-1 hover:bg-muted">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold">{selectedYear}</span>
              <button onClick={() => setSelectedYear(selectedYear + 1)} className="rounded p-1 hover:bg-muted">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Grille des 12 mois */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {monthlyData.map((d) => {
              const hasHours = d.hours > 0
              const hasCA = d.ca != null
              const isEditing = editingMonth === d.month
              const prodColor = d.productivity != null
                ? (d.productivity >= 85 && d.productivity <= 110 ? 'text-success' : 'text-destructive')
                : ''
              return (
                <div
                  key={d.month}
                  className={`rounded-xl border p-3 transition-colors ${
                    !hasHours ? 'border-border bg-muted/30 opacity-50' :
                    hasCA ? 'border-border bg-white' :
                    'border-warning/30 bg-warning/5'
                  }`}
                >
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{d.name}</p>

                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold">{hasHours ? `${d.hours}h` : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">heures attribuées</p>
                    </div>
                    {d.productivity != null && (
                      <div className="text-right">
                        <p className={`text-xl font-bold ${prodColor}`}>{d.productivity}</p>
                        <p className="text-[10px] text-muted-foreground">prod.</p>
                      </div>
                    )}
                  </div>

                  {hasHours && (
                    <div className="mt-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editingCA}
                            onChange={(e) => setEditingCA(e.target.value)}
                            placeholder="CA réalisé €"
                            className="h-7 text-xs"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCA(d.month)}
                          />
                          <Button size="sm" onClick={() => handleSaveCA(d.month)} className="h-7 px-2 text-[10px]">OK</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingMonth(d.month); setEditingCA(d.ca != null ? String(d.ca) : '') }}
                          className="w-full rounded-md border border-dashed border-slate-200 px-2 py-1 text-left text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          {hasCA ? `CA : ${d.ca!.toLocaleString('fr-FR')}€` : 'Renseigner le CA réalisé'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Graphique linéaire */}
          {chartData.length >= 2 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Évolution de la productivité {selectedYear}</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[60, 140]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <ReferenceLine y={95} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Cible 95', position: 'right', fontSize: 11, fill: '#94a3b8' }} />
                  <Line type="monotone" dataKey="productivité" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: '#6366f1' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {chartData.length < 2 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              Le graphique apparaîtra dès que 2 mois auront des heures attribuées et un CA renseigné.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Historique des plannings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <FileSpreadsheet size={15} className="text-slate-600" />
            </div>
            Historique des plannings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlannings && <p className="text-muted-foreground">Chargement...</p>}

          {!loadingPlannings && plannings.length === 0 && (
            <p className="text-muted-foreground">
              Aucun planning enregistré. Générez votre premier planning dans l'onglet "Planning salle".
            </p>
          )}

          {plannings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Semaine</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Début</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Généré le</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plannings.map((p, idx) => {
                    const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft
                    const prevPlanning = idx > 0 ? plannings[idx - 1] : null
                    const isNewWeek = prevPlanning && prevPlanning.weekNumber !== p.weekNumber
                    return (
                      <>
                        {isNewWeek && (
                          <tr key={`sep-${p.id}`}>
                            <td colSpan={5} className="py-1">
                              <div className="border-t-2 border-primary/20" />
                            </td>
                          </tr>
                        )}
                        <tr
                          key={p.id}
                          className="border-b border-border hover:bg-muted/30 cursor-pointer"
                          onClick={() => onViewPlanning?.(p.id, p.department)}
                        >
                        <td className="px-4 py-3 font-bold">
                          S{p.weekNumber}
                          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${p.department === 'cuisine' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {p.department === 'cuisine' ? 'Cuisine' : 'Salle'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(p.weekStartDate).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.generatedAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusInfo.color}`}>
                            {p.status === 'validated' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {p.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleValidate(p.id) }}
                              >
                                <CheckCircle size={14} className="mr-1" /> Valider
                              </Button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
