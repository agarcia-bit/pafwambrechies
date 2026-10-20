-- Per-association configuration of the Allianceo app: which sections it shows
-- and what it calls them, so the same app fits a shopkeepers' association, a
-- sports club or anything else. Stored in app_settings next to the branding
-- and returned with it (get_my_branding / resolve_signup_code).
--
--   module_annuaire | module_offres | module_agenda | module_idees | module_liens
--       'off' hides the section; absent or anything else keeps it (so existing
--       associations, and the PAF web app, are unaffected)
--   label_annuaire  name of the directory tab (default "Annuaire")
--   label_offres    name of the offers tab (default "Offres")
--   label_nom       signup field for the member's last name (default "Nom")
--   annuaire_categories / offres_categories
--       comma-separated filters; empty means no categories
--
-- None of these are secrets (unlike signup_code, which is never returned).
-- The PAF web app only reads the tenant_* keys through get_public_branding.

create or replace function public.branding_for_tenant(p_tenant uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object('slug', t.slug, 'name', t.name)
         || coalesce((
              select jsonb_object_agg(s.key, s.value)
              from public.app_settings s
              where s.tenant_id = t.id
                and s.key in ('tenant_name', 'tenant_tagline', 'tenant_primary_color',
                              'tenant_secondary_color', 'tenant_logo_url', 'tenant_login_bg_url',
                              'module_annuaire', 'module_offres', 'module_agenda',
                              'module_idees', 'module_liens',
                              'label_annuaire', 'label_offres', 'label_nom',
                              'annuaire_categories', 'offres_categories')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;

-- PAF keeps its current wording and categories, now written down explicitly:
-- an association without these settings starts neutral (no categories).
insert into public.app_settings (tenant_id, key, value)
select t.id, v.key, v.value
from public.tenants t,
  (values
    ('label_nom',           'Nom de l''entreprise'),
    ('annuaire_categories', 'Commerçant,Restauration,Services'),
    ('offres_categories',   'Particulier,Professionnel')
  ) as v(key, value)
where t.slug = 'paf-wambrechies'
on conflict (tenant_id, key) do nothing;
