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

## Étape 2 — app Expo (dossier `app/`) : écrite, reste le test sur téléphone
Expo SDK 57, Expo Router, onglets natifs (Liquid Glass sur iOS 26), React Query.
Mode d'emploi et organisation du code : `app/README.md`.

Fait (1re PR) :
- connexion (écran neutre Allianceo), inscription par code (l'asso trouvée s'affiche dans
  ses couleurs), mot de passe oublié (code à 6 chiffres reçu par email, sans lien ni adresse de retour) ;
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

Fait (2e PR) — Admin, dans Plus › Gestion, visible des seuls admins (routes protégées) :
- actus, offres, agenda, annuaire, liens : liste + formulaire commun (création, modification,
  suppression), décrits dans `app/src/lib/admin.ts` ;
- annuaire : photo choisie dans la galerie, recadrée au centre en 4:3 (800×600) comme la PWA,
  envoyée dans le bucket `annuaire-photos` ;
- idées : suppression (modération) ; réglages : code d'accès (bouton « Générer » : code
  aléatoire de 8 caractères, bouton « Partager »), nom, sous-titre, couleur, logo, et les deux
  réglages propres à la PWA ;
- publier une actu envoie la notification : le formulaire le rappelle.
Vérifié en base (transaction annulée) : écritures admin acceptées, adhérent refusé, code déjà
pris par une autre asso refusé. Pas encore testé : l'envoi de photo depuis un téléphone.

Fait (3e PR) — Pilotage bureau, dans Plus › Gestion, pour les membres du bureau et les admins :
- « À venir » (5 prochaines actions et leurs tâches ouvertes), « Actions » (en cours /
  terminées, tâches imbriquées, cases à cocher instantanées), « Équipe » (une carte par
  personne + « Non assigné », terminés masqués par défaut), comme dans `briefs/pilotage-bureau.md` ;
- nouvelle tâche confiée par défaut au référent de l'action ; changement de référent : le
  trigger existant le transmet aux tâches sans responsable (l'écran le signale) ;
- backend : `supabase/bureau_members.sql` (migration `bureau_members`, appliquée) ; la RLS de
  `profiles` ne montrait à un membre du bureau non admin que son propre profil, la fonction
  renvoie le bureau de son asso (vide pour un adhérent). Même fichier : `search_path` fixé sur
  le trigger `propagate_action_referent` (alerte des conseillers Supabase).
Vérifié en base (transaction annulée) : liste du bureau pour un membre non admin, héritage du
référent, suppression en cascade, adhérent sans accès.

Fait (adaptation à tous types d'associations) :
- chaque asso règle depuis Plus › Administration › Réglages : les sections visibles (annuaire,
  offres, agenda, idées, liens), le nom de l'annuaire et des offres, leurs catégories, et le
  libellé du champ « nom » à l'inscription (`supabase/tenant_app_config.sql`, migration
  `tenant_app_config`, clés dans `app_settings` renvoyées avec le branding) ;
- sans réglage : toutes les sections, mots neutres (Annuaire, Offres, Nom), aucune catégorie
  (valeur stockée « Général ») ; la PAF garde ses mots et ses catégories, écrits explicitement ;
- les écrans masqués sont aussi protégés contre l'accès direct (routes gardées).
Pas encore testé sur téléphone : le masquage des onglets et les écrans Admin correspondants.

Fait (fil d'actualité) :
- cartes d'actus (bande de couleur par catégorie, date en tuile façon Calendrier d'iPhone),
  liens cliquables dans les textes ;
- événements de l'Agenda dans le fil (« À venir », 3 prochains) avec « Ajouter à l'agenda » et
  « Vu » ; le « vu » est retenu sur le téléphone (par membre), pas en base ;
- sondages : l'admin en lance depuis Plus › Administration › Sondages (question + 2 à 6
  réponses, choix unique, option « obligatoire ») ; notification dédiée ; le sondage s'affiche
  en plein écran à l'ouverture de l'app, avec animations, avant tout le reste. Obligatoire :
  pas de « Plus tard », l'app reste bloquée jusqu'à la réponse. Sinon : le membre peut le
  repousser UNE fois (carte en attente en haut du fil + notification locale « ❗ Sondage en
  attente » programmée sur le téléphone 3 jours plus tard, même app fermée), puis il redevient
  obligatoire. Mêmes règles pour les admins (un admin qui lance un sondage obligatoire doit
  y répondre aussi). Réponses nominatives pour les admins, aucun résultat côté membre. Logique : `src/lib/poll-queue.ts` (testée),
  `poll-reminders.ts`. Fichier SQL de l'option : `supabase/sondages_obligatoire.sql`.
  Limite connue : le rappel n'existe qu'après un report ; un membre qui n'ouvre jamais l'app
  n'a que la notification initiale (un rappel serveur demanderait une tâche planifiée).
  **Les membres ne sont plus prévenus sur la carte que les admins voient leurs réponses : la
  politique de confidentialité d'Allianceo doit le dire (à écrire à l'étape 3).**
  Backend : `supabase/sondages.sql` (tables, droits, `creer_sondage()`, suppression des votes
  avec le compte, déclencheur `on_new_sondage`) ; la fonction `notify-new-actu` (v5, déployée)
  gère aussi les sondages, sans notification web PAF.
  Appliqués à la main dans le SQL Editor de Supabase (l'outil de migration est refusé) :
  `supabase/sondages.sql` et `supabase/actus_photos.sql`.
- photos d'actus : champ « Photo » dans le formulaire d'actu de l'Admin (recadrage 4:3,
  1200 px, bucket public `actus-photos`, envoi réservé aux admins) ; dans le fil la photo
  remplace la bande colorée, avec la catégorie et la date posées dessus.

Reste à faire :
1. Tester l'app entière sur iPhone (Expo Go), avec un compte adhérent et un compte admin.
2. Compte existant sans profil (ex. compte Immopilot) : l'app affiche « Aucune association ».
   Si besoin, ajouter une RPC pour rejoindre une asso avec un code depuis ce compte.
3. La PWA pourrait aussi utiliser `bureau_members()` (elle lit `profiles` directement).

Côté Andy pour tester sur iPhone :
- `cd app && npm install && npx expo start`, puis scanner le QR code avec Expo Go ;
- notifications : `npx eas-cli@latest init` (crée le projet EAS et son `projectId`) ; pour
  Android il faudra aussi un projet Firebase (FCM) déclaré dans EAS ;
- mot de passe oublié : coller le modèle d'email « Reset password » (Supabase › Authentication
  › Email Templates) qui contient `{{ .Token }}`. L'ancien modèle était cassé (variables
  échappées, aucun lien valable). Le modèle est commun à PAF, Immopilot (Kadastria) et
  Allianceo ; l'expéditeur « Kadastria » et l'objet sont à rendre neutres avant le lancement ;
- logo : renseigner `tenant_logo_url` dans les réglages de l'asso (sinon l'initiale s'affiche).

## Étape 3 — stores
EAS Build, TestFlight, fiches App Store Connect / Play Console, reprendre politique de
confidentialité et page de suppression au nom d'Allianceo, compte de démo pour l'examen.
Avant le lancement : expéditeur des emails d'authentification. Un seul réglage SMTP pour tout
le projet Supabase (Resend, « Kadastria » <connexion@kadastria.fr>), partagé avec Kadastria
(autre produit d'Andy) : ne rien y changer sans vérifier l'effet sur les emails de Kadastria.
Voies : « Send Email hook » (un expéditeur par produit, recommandé, à tester soigneusement) ou
signature commune « Agalumy » (domaine agalumy.fr à valider d'abord chez Resend, DKIM). Le
modèle « Reset password » est neutre (code seul, sans nom de produit).
Avant le lancement : codes d'accès aléatoires (pas du type nom + année), car
`resolve_signup_code` est appelable sans compte et un code devinable ouvre l'annuaire.

## Côté Andy (en parallèle)
- Inscription Apple Developer (organisation Agalumy, 99 $/an) : demande d'enrôlement
  envoyée, en attente de validation par Apple (le numéro D-U-N-S est dans les notes d'Andy,
  pas dans ce dépôt public).
- Compte Expo (expo.dev).
- Logo / icône Allianceo.

## Rôles (bureau / admin)

- `adherent`: member. `bureau`: manages the content (actus, offres, agenda, annuaire, liens, sondages, comment/idea moderation, photos) and the "Pilotage bureau". `admin`: all of that plus members/roles (Plus › Administration › Membres) and association settings (Réglages, signup code).
- `supabase/bureau_content_members.sql` (to run in the SQL Editor): content policies widened to `is_bureau_or_admin()`, `set_member_role()` (admin only, not on oneself), `member_names()` (poll results for bureau), and a security fix: a trigger forbids changing one's own `role` (any member could make themselves admin through the API) and the "Users insert own profile" policy is dropped.
- The PWA still shows its admin screens to admins only; bureau rights apply server-side.
