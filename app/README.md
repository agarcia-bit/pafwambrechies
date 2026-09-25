# Allianceo — app native (Expo)

Une seule app iOS / Android pour toutes les associations (`fr.agalumy.allianceo`).
L'association vient du compte connecté (ou du code d'accès à l'inscription) ; l'app
prend alors son nom, son logo et sa couleur (`get_my_branding()`).

Backend : le projet Supabase partagé (`ancwbfyjzaebxahtlqkm`), voir
`../supabase/allianceo_app_backend.sql` et `../briefs/allianceo.md`.

## Lancer l'app

```bash
npm install
npx expo start
```

Scanner le QR code avec l'app **Expo Go** sur l'iPhone (même Wi-Fi que l'ordinateur).
`npx expo start --web` ouvre une version navigateur, pratique pour vérifier un écran
(sans notifications ni ajout à l'agenda).

Avant de livrer : `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.

## Organisation

- `src/app/` : les écrans (Expo Router, un fichier = une route)
  - `connexion`, `inscription`, `mot-de-passe-oublie`, `nouveau-mot-de-passe`
  - `(app)/` : l'app connectée, 5 onglets natifs : `(actus)`, `annuaire`, `offres`,
    `agenda`, `plus` (idées, liens, mon compte, et selon le rôle `bureau/` et `admin/`)
- `src/lib/` : Supabase, session, requêtes (React Query), notifications, formats ;
  `admin.ts` décrit chaque contenu administrable, `bureau.ts` les actions et tâches
- `src/components/` : composants partagés (`ui/` pour les briques de base)
- `src/theme/` : couleurs clair / sombre, teintées par la couleur de l'association

## Notifications

`notify-new-actu` envoie aux jetons de `device_tokens`. Il faut un projet EAS pour
obtenir un jeton : `npx eas-cli@latest init` (écrit `extra.eas.projectId` dans
`app.json`). Sans lui, l'app indique que les notifications ne sont pas disponibles.
