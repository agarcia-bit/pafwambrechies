# Créer un nouveau tenant (nouvelle asso cliente)

Compte cette procédure environ **20 à 30 minutes** au total. Elle suit toujours la
même séquence : nouveau projet Supabase → SQL de bootstrap → clone du site
Netlify → variables d'environnement → configuration finale depuis l'admin.

Aucune modification de code n'est nécessaire.

## 1) Créer le projet Supabase (~5 min)

1. Dashboard Supabase → **New project** dans l'organisation qui facture.
2. Nom : `paf-<ville>` (ex : `paf-halluin`).
3. Région : Frankfurt / Paris.
4. Choisir un mot de passe de base fort et le stocker dans ton gestionnaire.
5. Une fois le projet prêt, note dans un coin :
   - **Project URL** (Settings → API → Project URL)
   - **anon public key** (Settings → API → Project API keys → `anon`)

## 2) Exécuter les SQL de bootstrap dans l'ordre (~5 min)

Dans **SQL Editor → New query**, coller et exécuter chaque fichier suivant, dans
cet ordre, un par un :

1. `supabase/schema.sql` — tables principales + RLS de base
2. `supabase/actus_interactions.sql` — likes + commentaires actus
3. `supabase/storage_annuaire.sql` — bucket photos annuaire
4. `supabase/admin_policies.sql` — fonction `is_admin()` + policies admin
5. `supabase/profiles_autocreate.sql` — trigger de création automatique de profil
6. `supabase/comments_admin_delete.sql` — modération commentaires
7. `supabase/signup_code.sql` — table `app_settings` + code d'inscription initial
8. `supabase/tenant_branding.sql` — clés de branding + `get_public_branding()`

Chacun est idempotent : si tu le relances par erreur, ça ne casse rien.

## 3) Désactiver la confirmation email (~1 min)

Dashboard Supabase → **Authentication → Sign In / Providers → Email** →
décocher **Confirm email**. Sans ça, les nouveaux inscrits doivent confirmer
leur email avant de pouvoir se connecter.

## 4) Cloner le site Netlify (~5 min)

Deux options :

**A. Nouveau site depuis le même repo** (recommandé)
1. Netlify → **Add new site → Import an existing project → GitHub** →
   sélectionner `agarcia-bit/pafwambrechies`.
2. Branch to deploy : `main`.
3. Build command : `node scripts/generate-config.js` (déjà dans `netlify.toml`).
4. Publish directory : `.` (déjà dans `netlify.toml`).
5. Nommer le site : ex. `paf-halluin.netlify.app`.

**B. Fork du repo si le client veut un dépôt à lui**
Fork GitHub puis pointer un nouveau site Netlify dessus.

## 5) Renseigner les variables d'environnement (~2 min)

Dans **Site settings → Environment variables** du nouveau site Netlify :

| Clé                  | Valeur                                             |
|----------------------|----------------------------------------------------|
| `SUPABASE_URL`       | Project URL du nouveau projet Supabase             |
| `SUPABASE_ANON_KEY`  | anon public key du nouveau projet Supabase         |

Puis **Deploys → Trigger deploy → Deploy site** pour reconstruire avec les nouvelles valeurs.

## 6) Configurer le branding depuis l'app (~5 min)

1. Ouvre le nouveau site (`paf-<ville>.netlify.app`).
2. Crée-toi un compte via **Créer mon compte** (le code par défaut est `PAF2026`).
3. Dans Supabase → Table Editor → `profiles`, mets ton `role` à `admin`.
4. Reconnecte-toi dans l'app.
5. Va dans l'onglet **Admin → Réglages** et renseigne :
   - Nom de l'association
   - Sous-titre
   - Couleur principale
   - URL du logo (à héberger dans le bucket Supabase Storage ou ailleurs)
   - URL de l'image de fond du login (optionnel)
   - Code d'inscription à communiquer aux futurs adhérents

Le nom apparaît dans l'onglet du navigateur, l'en-tête, et sur le login. La
couleur s'applique partout via la variable `--accent`.

## 7) Communiquer le code au client (~1 min)

Dans WhatsApp / email : « L'appli est prête à `https://paf-<ville>.netlify.app`.
Pour créer votre compte, cliquez sur *Créer mon compte* et utilisez le code
`XXXX`. »

## Facultatif — Domaine custom

Netlify → Domain settings → Add custom domain. Compter 12€/an refacturés au
client si on lui prend son propre nom de domaine.

## Facultatif — Publication Play Store / App Store

Cf. procédure séparée (à venir). Le tenant est déjà utilisable comme PWA
installable "Ajouter à l'écran d'accueil" sans passer par les stores.
