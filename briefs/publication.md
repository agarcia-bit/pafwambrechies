# Publier Allianceo : builds, TestFlight, stores

Ce que le dépôt prépare (`app/eas.json`) et ce qu'il reste à faire avec les comptes. Les textes des fiches
sont dans `briefs/store-listing.md`.

## Profils de build (`app/eas.json`)

| Profil | Pour quoi | Résultat |
|---|---|---|
| `development` | tester avec les outils de développement, hors Expo Go (notifications push à distance comprises) | app de développement à installer |
| `preview` | donner l'app à des testeurs avant la publication | Android : fichier APK ; iOS : build interne |
| `production` | les stores | iOS : envoi vers TestFlight / App Store ; Android : fichier AAB pour Google Play |

Le numéro de build s'incrémente tout seul pour `production` (`autoIncrement`), le numéro de version
(`1.0.0`) est dans `app/app.json`.

## Étape 1 : relier le projet à Expo (une seule fois)

Compte Expo : déjà connecté sur ce Mac (`npx eas-cli whoami`), avec l'organisation **agalumy**.

```bash
cd app
npx eas-cli init
```

Choisir l'organisation **agalumy** : EAS crée le projet « allianceo » et écrit son identifiant dans `app.json`
(`extra.eas.projectId`). Cet identifiant est nécessaire aux notifications push à distance. Commiter le changement.

## Étape 2 : un premier build de test (Android, sans compte Apple ni Google)

```bash
npx eas-cli build --profile preview --platform android
```

EAS compile dans le cloud (environ 15 minutes) et donne un lien et un QR code pour installer l'APK sur un téléphone
Android. C'est le moyen le plus rapide de vérifier une vraie version, hors Expo Go.

## Étape 3 : iPhone (nécessite le compte développeur Apple actif)

1. Build de production : `npx eas-cli build --profile production --platform ios`. EAS demande l'identifiant Apple et crée
   lui-même le certificat, le profil de distribution et la clé des notifications (APNs).
2. Envoi vers TestFlight : `npx eas-cli submit --profile production --platform ios`. La première fois, créer l'app dans
   App Store Connect (nom « Allianceo », identifiant `fr.agalumy.allianceo`, langue française).
3. Dans TestFlight : ajouter les testeurs internes (aucune relecture Apple), puis les externes (relecture d'environ un jour).
4. Pour la publication : dans App Store Connect, remplir la fiche avec `briefs/store-listing.md`, les captures d'écran, les
   notes du relecteur (compte de démonstration) et soumettre à la relecture.

## Étape 4 : Android et Google Play

1. Créer le compte Google Play Console (25 $, une fois) et l'app « Allianceo ».
2. **Notifications push Android** : créer un projet Firebase (gratuit), y ajouter l'app Android `fr.agalumy.allianceo`,
   télécharger `google-services.json` (le placer dans `app/`, ne pas le commiter s'il contient des clés privées : il n'en
   contient pas, mais le mettre dans `.gitignore` par prudence) et ajouter dans `app.json` :
   `"android": { "googleServicesFile": "./google-services.json" }`. Envoyer la clé de compte de service FCM à EAS :
   `npx eas-cli credentials` (Android, Google Service Account Key for FCM V1).
3. Build : `npx eas-cli build --profile production --platform android` (fichier AAB).
4. Envoi : `npx eas-cli submit --profile production --platform android` (piste « interne », brouillon). Il faut d'abord
   créer une clé de compte de service Google Play et la donner à EAS.
5. Remplir la fiche, la classification du contenu et la sécurité des données avec `briefs/store-listing.md`.

## Avant d'envoyer à la relecture

- [ ] Politique de confidentialité et page de suppression de compte en ligne (c'est fait) et relues.
- [ ] Compte de démonstration dans les notes du relecteur (mot de passe à ajouter dans App Store Connect).
- [ ] Captures d'écran prises depuis l'espace « Association Démo ».
- [ ] E-mails de connexion envoyés par « Agalumy » (réglage SMTP de Supabase).
- [ ] Test d'étanchéité entre associations relancé (`supabase/tests/tenant_isolation.sql`).
- [ ] Un build `preview` installé sur un vrai téléphone : connexion, actus, agenda, notification de test.
