# Allianceo — passation (reprise en session locale)

## Décisions prises
- **Produit** : Allianceo, une **seule app** multi-associations sur l'App Store et le Play Store (option B).
  Pas une app par asso : Apple l'interdit (règle 4.2.6) et Google a une règle
  similaire contre les applis répétitives.
- **Identifiant de l'app** : `fr.agalumy.allianceo` (définitif une fois publié).
- **Éditeur** : société Agalumy (compte Apple Developer organisation, numéro D-U-N-S requis).
- **Techno** : app native **React Native / Expo** (EAS Build, EAS Update pour les mises à
  jour sans nouvel examen). Conception pensée d'abord pour l'App Store, Android décliné.
- **Backend** : le projet Supabase **existant** (`ancwbfyjzaebxahtlqkm`), partagé avec
  Immopilot. Pas de nouveau projet.
- **Un adhérent = une asso** (`profiles.tenant_id`, immuable).
- **Pas de choix d'asso dans l'app** : l'asso vient du compte (connexion) ou du code
  d'accès (inscription). Écran de connexion neutre Allianceo, puis branding de l'asso.
- L'app Bubblewrap `fr.paf.wambrechies` (test interne Play) est **abandonnée**, pas de
  passage en production. La PWA PAF continue de tourner jusqu'au lancement d'Allianceo.

## Étape 1 — backend : terminée
Fait et appliqué sur Supabase :
- `supabase/signup_tenant_resolution.sql` : `handle_new_user` résout l'asso par code
  d'accès (prioritaire), puis par `tenant_slug` (ancien web), sinon **aucun profil**
  (corrige le rattachement des inscrits Immopilot à la PAF). Code inconnu = inscription refusée.
  Testé.
- `supabase/allianceo_app_backend.sql` : codes d'accès uniques entre assos,
  `resolve_signup_code(code)`, `get_my_branding()`, table `device_tokens` +
  `register_device_token` / `unregister_device_token`, `delete_my_account()`
  (garde le login partagé si le compte a des données dans une autre app). Testé, y compris
  un compte aussi présent dans Immopilot (login et ligne `immopilot.profils` conservés).
- Edge function `notify-new-actu` (v4 déployée, `verify_jwt: true`) :
  - n'envoie qu'aux abonnés de l'asso de l'actu (`actu.tenant_id`) ;
  - texte « Nouvelle publication sur <nom de l'asso> » (`tenant_name`, sinon `tenants.name`) ;
  - web push (PWA) + Expo push sur `device_tokens` (lots de 100, `data: { actu_id }`) ;
  - supprime les abonnements web en 404/410 et les jetons Expo `DeviceNotRegistered` ;
  - répond 403 à tout appelant autre que `service_role` : `verify_jwt` seul laissait passer
    la clé anon publique, donc n'importe qui pouvait envoyer une notification à tous.
  - Testée de bout en bout sur le tenant `demo` (faux destinataires, actu de test supprimée).
  - Secret optionnel `EXPO_ACCESS_TOKEN`, à poser si on active la « enhanced push security » d'Expo.

## Étape 2 — app Expo (dossier `app/`) : en cours
Expo SDK 57, Expo Router, onglets natifs (Liquid Glass sur iOS 26), React Query.
Mode d'emploi et organisation du code : `app/README.md`.

Fait (1re PR) :
- connexion (écran neutre Allianceo), inscription par code (l'asso trouvée s'affiche dans
  ses couleurs), mot de passe oublié (lien `allianceo://nouveau-mot-de-passe`, flux PKCE) ;
- 5 onglets, pas 6 (maximum Apple sur iPhone, limite Android) : Actus, Annuaire, Offres,
  Agenda, Plus (Idées, Liens, Mon compte). J'aime et commentaires sur les actus et les idées ;
- Mon compte : notifications, déconnexion (locale seulement, le login est partagé avec
  Immopilot), suppression du compte (`delete_my_account()`) ;
- notifications : téléphone enregistré après connexion (`register_device_token`), retiré à
  la déconnexion ; le tap ouvre l'actu (`data.actu_id`) ;
- « Ajouter à mon agenda » : feuille système, sans permission à partir d'iOS 17 ;
- différence voulue avec la PWA : les offres expirées ne sont plus affichées.

Vérifié : TypeScript, lint, `expo-doctor`, bundles iOS et Android, écrans non connectés dans
le navigateur (connexion, code inconnu, aperçu de l'asso, redirection sans session).
Pas encore testé : les écrans connectés sur un vrai téléphone (Expo Go).

Reste à faire :
1. Admin (2e PR) : actus, offres, agenda, annuaire (avec photo), idées, liens, réglages.
2. Bureau (3e PR) : À venir, Actions, Todo liste équipe (`briefs/pilotage-bureau.md`).
3. Compte existant sans profil (ex. compte Immopilot) : l'app affiche « Aucune association ».
   Si besoin, ajouter une RPC pour rejoindre une asso avec un code depuis ce compte.

Côté Andy pour tester sur iPhone :
- `cd app && npm install && npx expo start`, puis scanner le QR code avec Expo Go ;
- notifications : `npx eas-cli@latest init` (crée le projet EAS et son `projectId`) ; pour
  Android il faudra aussi un projet Firebase (FCM) déclaré dans EAS ;
- mot de passe oublié : ajouter `allianceo://**` aux Redirect URLs de Supabase Auth
  (pour Expo Go, ajouter aussi l'adresse `exp://…` affichée par `expo start`, le temps des tests) ;
- logo : renseigner `tenant_logo_url` dans les réglages de l'asso (sinon l'initiale s'affiche).

## Étape 3 — stores
EAS Build, TestFlight, fiches App Store Connect / Play Console, reprendre politique de
confidentialité et page de suppression au nom d'Allianceo, compte de démo pour l'examen.
Avant le lancement : codes d'accès aléatoires (pas du type nom + année), car
`resolve_signup_code` est appelable sans compte et un code devinable ouvre l'annuaire.

## Côté Andy (en parallèle)
- Numéro D-U-N-S pour Agalumy, puis inscription Apple Developer (organisation, 99 $/an).
- Compte Expo (expo.dev).
- Logo / icône Allianceo.
