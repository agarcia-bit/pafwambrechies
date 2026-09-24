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

## Étape 1 — backend : état
Fait et appliqué sur Supabase :
- `supabase/signup_tenant_resolution.sql` : `handle_new_user` résout l'asso par code
  d'accès (prioritaire), puis par `tenant_slug` (ancien web), sinon **aucun profil**
  (corrige le rattachement des inscrits Immopilot à la PAF). Code inconnu = inscription refusée.
  Testé.
- `supabase/allianceo_app_backend.sql` : codes d'accès uniques entre assos,
  `resolve_signup_code(code)`, `get_my_branding()`, table `device_tokens` +
  `register_device_token` / `unregister_device_token`, `delete_my_account()`
  (garde le login partagé si le compte a des données dans une autre app). Testé, sauf
  le cas « compte aussi présent dans Immopilot » (test interrompu, à faire).

Reste à faire :
1. Tester `delete_my_account` sur un compte ayant aussi une ligne `immopilot.profils`
   (dans une transaction annulée, pour ne rien laisser dans Immopilot).
2. Réécrire l'edge function `notify-new-actu` :
   - **bug actuel** : elle envoie à *tous* les abonnés, toutes assos confondues → filtrer
     par `actu.tenant_id` ;
   - texte « Nouvelle publication sur <nom de l'asso> » (au lieu de « PAF Wambrechies » en dur) ;
   - envoyer aussi aux `device_tokens` via l'API Expo Push
     (`https://exp.host/--/api/v2/push/send`, lots de 100) ;
   - supprimer les abonnements web (404/410) et tokens Expo (`DeviceNotRegistered`) invalides ;
   - garder `verify_jwt: true` (le trigger `on_new_actu` envoie un JWT service_role).

## Étape 2 — app Expo (dossier `app/`)
Écrans : connexion, inscription par code (affiche l'asso trouvée), mot de passe oublié,
6 onglets (Actus, Annuaire, Offres, Idées, Agenda, Liens), Admin, Bureau, Mon compte
(déconnexion, notifications, **supprimer mon compte**). Branding via `get_my_branding()`.

## Étape 3 — stores
EAS Build, TestFlight, fiches App Store Connect / Play Console, reprendre politique de
confidentialité et page de suppression au nom d'Allianceo, compte de démo pour l'examen.

## Côté Andy (en parallèle)
- Numéro D-U-N-S pour Agalumy, puis inscription Apple Developer (organisation, 99 $/an).
- Compte Expo (expo.dev).
- Logo / icône Allianceo.
