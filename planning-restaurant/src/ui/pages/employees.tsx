import { useEffect } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components'
import { getWeeklyBounds } from '@/domain/models/employee'

const CONTRACT_LABELS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  extra: 'Extra',
  apprenti: 'Apprenti',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Niv. 1',
  2: 'Niv. 2',
  2.5: 'Niv. 2bis',
  3: 'Niv. 3',
  4: 'Manager',
}

export function EmployeesPage() {
  const { employees, loading, load } = useEmployeeStore()

  useEffect(() => {
    load()
  }, [load])

  const activeEmployees = employees.filter((e) => e.active)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salariés</h1>
        {/* TODO: Bouton ajouter salarié */}
      </div>

      {loading && <p className="text-muted-foreground">Chargement...</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contrat</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Heures</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bornes</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Niveau</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp) => {
              const bounds = getWeeklyBounds(emp)
              return (
                <tr key={emp.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">
                    {emp.firstName} {emp.lastName}
                  </td>
                  <td className="px-4 py-3">{CONTRACT_LABELS[emp.contractType] ?? emp.contractType}</td>
                  <td className="px-4 py-3">{emp.weeklyHours}h</td>
                  <td className="px-4 py-3">{bounds.min}h — {bounds.max}h</td>
                  <td className="px-4 py-3">{LEVEL_LABELS[emp.level] ?? `Niv. ${emp.level}`}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${emp.isManager ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                      {emp.isManager ? 'Manager' : 'Salarié'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && activeEmployees.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aucun salarié</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Ajoutez vos premiers salariés pour commencer à générer des plannings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
