# Créer un nouveau tenant (nouvelle asso cliente)

Compte cette procédure environ **5 à 10 minutes** par nouveau tenant. Toutes les
assos partagent la même base Supabase — chaque tenant est cloisonné par un
`tenant_id` posé automatiquement partout via RLS. Il te faut donc juste :

1. Créer une ligne dans la table `tenants` côté Supabase.
2. Créer un site Netlify avec la variable d'environnement `TENANT_SLUG`.
3. Créer ton premier compte admin sur cette instance.

Aucune modification de code.

## 1) Créer la ligne du tenant (~1 min)

Dans Supabase → **SQL Editor** → **New query**, colle et adapte :

```sql
insert into public.tenants (slug, name)
values ('halluin', 'PAF Halluin');

insert into public.app_settings (tenant_id, key, value)
select id, k, v
from public.tenants,
  (values
    ('signup_code',           'HALLUIN2026'),
    ('tenant_name',            'PAF Halluin'),
    ('tenant_tagline',         'Espace adhérents'),
    ('tenant_primary_color',   '#2E3192'),
    ('tenant_logo_url',        ''),
    ('tenant_login_bg_url',    '')
  ) as s(k, v)
where slug = 'halluin'
on conflict (tenant_id, key) do nothing;
```

Le `slug` doit être court, en minuscules, sans espaces (ex. `halluin`,
`marcq`, `bondues`). C'est lui qui identifie le tenant dans l'app.

## 2) Créer le site Netlify (~3 min)

1. Netlify → **Add new site → Import an existing project → GitHub** →
   sélectionner `agarcia-bit/pafwambrechies`.
2. Branch : `main`. Build command et publish directory : déjà configurés
   dans `netlify.toml`.
3. Nommer le site : ex. `paf-halluin.netlify.app`.
4. Une fois créé → **Site settings → Environment variables** :

| Clé            | Valeur    |
|----------------|-----------|
| `TENANT_SLUG`  | `halluin` |

Pas besoin de renseigner `SUPABASE_URL` ni `SUPABASE_ANON_KEY` — ils sont
partagés et hérités des valeurs par défaut du build script.

5. **Deploys → Trigger deploy → Deploy site** pour reconstruire avec le
   nouveau `TENANT_SLUG`.

## 3) Créer le premier admin de ce tenant (~3 min)

1. Ouvre `paf-halluin.netlify.app` dans un navigateur privé (pour ne pas
   te mélanger avec ta session PAF Wambrechies).
2. Clique **Créer mon compte** → renseigne tes coordonnées + le code
   d'inscription que tu as mis dans le SQL (`HALLUIN2026` dans l'exemple).
3. Une fois inscrit, va dans Supabase → **Table Editor → profiles** :
   - Filtrer par email ou par `tenant_id`
   - Passer `role` de `adherent` à `admin`
4. Retourne dans l'app, déconnexion / reconnexion → tu vois l'onglet Admin.

## 4) Personnaliser depuis Admin → Réglages (~2 min)

Dans l'onglet **Admin → Réglages** de ta nouvelle instance :
- Nom de l'association
- Sous-titre
- Couleur principale
- URL du logo (à héberger n'importe où d'accessible en HTTPS)
- URL de l'image de fond du login (optionnel)
- Code d'inscription

L'appliquette applique tout immédiatement (nom dans l'onglet du navigateur,
couleur des boutons, logo dans l'en-tête, etc.).

## 5) Communiquer au client

WhatsApp / email : « L'appli est prête à `https://paf-halluin.netlify.app`.
Pour créer votre compte, cliquez sur *Créer mon compte* et utilisez le code
`HALLUIN2026`. »

## Facultatif — Domaine custom

Netlify → Domain settings → Add custom domain. Compter 12€/an refacturés au
client si tu prends un nom de domaine pour lui.

## Facultatif — Publication Play Store / App Store

Compte séparé, procédure à documenter à part. Le tenant est déjà utilisable
comme PWA installable "Ajouter à l'écran d'accueil" sans passer par les
stores.

## Architecture rappel

- **1 Supabase** partagé (`ancwbfyjzaebxahtlqkm.supabase.co`).
- **N Netlify sites**, un par tenant, tous pointant sur le même code.
- Le tenant est identifié par la variable d'environnement `TENANT_SLUG`
  au build time, lue au boot par `applyTenantBranding()` et propagée
  dans chaque écriture DB via `withTenant()`.
- Les policies RLS de Postgres garantissent qu'un tenant ne peut ni lire
  ni écrire dans les données d'un autre.
