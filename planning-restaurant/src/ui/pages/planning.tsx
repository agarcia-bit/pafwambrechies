import { Card, CardContent, CardHeader, CardTitle, Button } from '@/ui/components'

export function PlanningPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Génération de Planning</h1>
        <Button disabled>
          Générer le planning
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration requise</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Avant de générer un planning, assurez-vous d'avoir configuré :
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground">
            <li>Les salariés et leurs contrats</li>
            <li>Les rôles (serveur, barman, etc.)</li>
            <li>Les créneaux horaires autorisés</li>
            <li>Les indisponibilités des salariés</li>
            <li>Le CA prévisionnel par jour</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
