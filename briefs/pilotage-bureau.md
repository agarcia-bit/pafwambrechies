# 📋 Brief — Espace « Pilotage bureau »

Statut : **backlog**, à implémenter dans une session dédiée après la stabilisation
du multi-tenant et le lancement Play Store / App Store.

## Contexte
Ajouter un espace réservé au bureau (gated sur `role IN ('bureau', 'admin')`),
invisible pour les adhérents. Multi-tenant : chaque table porte un `tenant_id`
et le RLS ne laisse voir/éditer que les lignes du tenant dont l'utilisateur est
membre. Réutiliser l'auth et les profils existants (le schéma actuel utilise
déjà `tenant_id`, on le garde — pas de `org_id` séparé).

## Modèle de données Supabase

### Table `actions`

| Colonne     | Type                       | Notes                                   |
|-------------|----------------------------|-----------------------------------------|
| `id`        | bigint identity            |                                         |
| `tenant_id` | uuid FK `tenants`          | isolation tenant                        |
| `emoji`     | text                       | ex. ☕ 🎉                                |
| `titre`     | text                       |                                         |
| `date_action` | date                     |                                         |
| `referent`  | uuid FK `profiles`, nullable | membre du bureau responsable          |
| `statut`    | text                       | À faire · En cours · Terminé · Bloqué   |
| `budget`    | int, nullable              | €                                       |
| `created_at`| timestamptz                |                                         |

### Table `taches`

| Colonne       | Type                                   | Notes                                       |
|---------------|----------------------------------------|---------------------------------------------|
| `id`          | bigint identity                        |                                             |
| `tenant_id`   | uuid FK `tenants`                      |                                             |
| `action_id`   | bigint FK `actions` on delete cascade  | supprimer l'action supprime ses tâches      |
| `libelle`     | text                                   |                                             |
| `responsable` | uuid FK `profiles`, nullable           |                                             |
| `echeance`    | date, nullable                         |                                             |
| `statut`      | text                                   | À faire · En cours · Terminé                |
| `priorite`    | text                                   | Haute · Moyenne · Basse                     |

**RLS sur les deux tables** : lecture/écriture uniquement si
`tenant_id = current_tenant_id()` ET (`is_admin()` OU `role = 'bureau'`). Prévoir
une helper `is_bureau_or_admin()` similaire à `is_admin()` déjà en place.

## Fonction 1 — Dashboard bureau « À venir »

Afficher **uniquement** les 5 prochaines actions :
- `date_action >= today` **ET** `statut != 'Terminé'`
- triées par `date_action` croissante
- `limit 5`

Chaque carte affiche : **date · emoji · titre · référent (pastille) · statut**,
et en dessous la liste des tâches encore ouvertes de l'action
(`statut != 'Terminé'`, triées par échéance, celles en retard en rouge).

**Pas** de KPIs / graphiques / calendrier sur ce dashboard — volontairement minimal.

## Fonction 2 — Onglet « Actions » (tâches imbriquées comme sous-éléments)

- Liste des actions triée par `date_action` croissante, **éditable inline**
  (titre, date, référent, statut, budget).
- Chaque action déroule ses tâches en sous-lignes (regroupées sous l'action,
  pas dans un onglet séparé). Par tâche : case à cocher (bascule Terminé),
  libellé, responsable (menu), échéance (éditable), bouton supprimer.
- Boutons **+ Nouvelle action** et **+ Nouvelle tâche** (la tâche se rattache
  à une action).
- **Défaut malin** : à la création d'une tâche, le responsable est pré-rempli
  avec le référent de l'action (modifiable). Quand on change le référent
  d'une action, les tâches **sans responsable** héritent du nouveau référent
  (celles déjà assignées ne bougent pas).
- Bascule **En cours** / **Terminées** : "En cours" = `statut != 'Terminé'`,
  "Terminées" = archive. Une action terminée sort de la vue courante.

## Fonction 3 — « Todo List équipe » (ex-onglet Équipe)

- Renommer l'intitulé en **« Todo List équipe »**.
- Une carte par membre du bureau : les actions dont il est référent + les
  tâches qui lui sont assignées, triées par date/échéance, en retard
  surlignées.
- Une carte **« Non assigné »** regroupe les actions sans référent et les
  tâches sans responsable.
- Bouton **« Afficher / Masquer les terminés »** (masqués par défaut).

## Note d'intégration

Un prototype fonctionnel de ces 3 fonctions existe déjà (app bureau
**paf-bureau**, single-file HTML/JS) — il peut servir de référence visuelle et
comportementale.

**Logique clé à conserver** :
- tri par date
- tâches rattachées par `action_id`
- héritage référent → responsable
- vue archive pour les terminés
