import { Card, CardContent, CardHeader, CardTitle, Button } from '@/ui/components'
import { useEmployeeStore } from '@/store/employee-store'
import { useEffect, useState } from 'react'
import { fetchPlannings, updatePlanningStatus, deletePlanning } from '@/infrastructure/supabase/repositories/planning-repo'
import type { SavedPlanning } from '@/infrastructure/supabase/repositories/planning-repo'
import { CheckCircle, Clock, Trash2, FileSpreadsheet } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-warning/10 text-warning' },
  validated: { label: 'Validé', color: 'bg-success/10 text-success' },
}

export function DashboardPage({ onViewPlanning }: { onViewPlanning?: (id: string, department?: string) => void }) {
  const { employees, load } = useEmployeeStore()
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
    // Load plannings inline to satisfy strict lint
    fetchPlannings()
      .then(setPlannings)
      .catch(() => {})
      .finally(() => setLoadingPlannings(false))
  }, [load])

  const activeEmployees = employees.filter((e) => e.active)
  const managers = activeEmployees.filter((e) => e.isManager)
  const staff = activeEmployees.filter((e) => !e.isManager)

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Salariés actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeEmployees.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Managers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{managers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Équipe salle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{staff.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Historique des plannings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} />
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
                  {plannings.map((p) => {
                    const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft
                    return (
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
