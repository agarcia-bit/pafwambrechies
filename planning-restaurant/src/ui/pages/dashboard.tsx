import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components'
import { useEmployeeStore } from '@/store/employee-store'
import { useEffect } from 'react'

export function DashboardPage() {
  const { employees, load } = useEmployeeStore()

  useEffect(() => {
    load()
  }, [load])

  const activeEmployees = employees.filter((e) => e.active)
  const managers = activeEmployees.filter((e) => e.isManager)
  const staff = activeEmployees.filter((e) => !e.isManager)

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

      <Card>
        <CardHeader>
          <CardTitle>Prochaine étape</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configurez vos salariés, rôles et créneaux horaires, puis générez
            votre premier planning dans l'onglet "Planning".
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
