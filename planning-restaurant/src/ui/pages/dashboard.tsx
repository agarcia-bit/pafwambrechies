import { Card, CardContent, CardHeader, CardTitle, Button } from '@/ui/components'
import { useEmployeeStore } from '@/store/employee-store'
import { useForecastStore } from '@/store/forecast-store'
import { useEffect, useMemo, useState } from 'react'
import { fetchPlannings, updatePlanningStatus, deletePlanning } from '@/infrastructure/supabase/repositories/planning-repo'
import type { SavedPlanning } from '@/infrastructure/supabase/repositories/planning-repo'
import { CheckCircle, Clock, Trash2, FileSpreadsheet, Users, Euro } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-warning/10 text-warning' },
  validated: { label: 'Validé', color: 'bg-success/10 text-success' },
}

/** Retourne le lundi de la semaine courante (ou le lundi du jour si on est lundi). */
function getCurrentMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay() // 0=dim, 1=lun, ..., 6=sam
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function DashboardPage({ onViewPlanning }: { onViewPlanning?: (id: string, department?: string) => void }) {
  const { employees, load } = useEmployeeStore()
  const { forecasts, load: loadForecasts } = useForecastStore()
  const [plannings, setPlannings] = useState<SavedPlanning[]>([])
  const [loadingPlannings, setLoadingPlannings] = useState(false)

  function refreshPlannings() {
    setLoadingPlannings(true)
    fetchPlannings()
      .then(setPlannings)
      .catch(() => {})
      .finally(() => setLoadingPlannings(false))
  }

  useEffect(() => {
    load()
    loadForecasts()
    // Load plannings inline to satisfy strict lint
    fetchPlannings()
      .then(setPlannings)
      .catch(() => {})
      .finally(() => setLoadingPlannings(false))
  }, [load, loadForecasts])

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

  // CA prévu cette semaine = somme des forecasts pour chaque jour de la semaine courante
  // (lundi fermé => on itère les jours 1..6 = mardi..dimanche, comme la page planning)
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
              Aucun planning enregistré. Générez et enregistrez votre premier planning dans l'onglet "Générer un planning".
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
