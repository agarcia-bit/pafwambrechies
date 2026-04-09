import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components'

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Restaurant</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configuration du restaurant, horaires d'ouverture, paramètres de productivité.
          </p>
          {/* TODO: Formulaire paramètres restaurant */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Créneaux horaires</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Gestion des créneaux horaires autorisés pour la génération de planning.
          </p>
          {/* TODO: CRUD créneaux */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CA Prévisionnel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Saisie du chiffre d'affaires N-1 par mois et jour de semaine.
          </p>
          {/* TODO: Grille CA */}
        </CardContent>
      </Card>
    </div>
  )
}
