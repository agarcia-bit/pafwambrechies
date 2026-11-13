-- ── Message de la campagne de cotisation ─────────────────────────────────────
-- Un texte libre du bureau (code promo, conditions de renouvellement…), affiché dans la fenêtre
-- « Ma cotisation » de l'application pendant la campagne. Ni le bandeau ni le rappel du lundi
-- ne changent. Réglage cotisation_message (app_settings), transmis avec les autres réglages.
-- Peut être relancé sans risque.

-- 1. Le réglage voyage avec les autres réglages de cotisation.
create or replace function public.branding_for_tenant(p_tenant uuid)
returns jsonb
language sql
stable
security definer
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
                              'module_idees', 'module_liens', 'module_documents',
                              'label_annuaire', 'label_offres', 'label_nom',
                              'annuaire_categories', 'offres_categories',
                              'module_cotisations', 'cotisation_url', 'cotisation_montant',
                              'cotisation_libelle', 'cotisation_ouverture', 'cotisation_fin',
                              'cotisation_message')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;

-- 2. Le bureau l'enregistre avec les autres réglages. L'ancienne version à 5 paramètres reste,
--    pour l'application pas encore mise à jour : elle ne touche pas au message.
create or replace function public.save_cotisation_settings(
  p_url text,
  p_montant text,
  p_libelle text,
  p_ouverture date,
  p_fin date,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
begin
  if char_length(v_message) > 500 then
    raise exception 'message_trop_long' using errcode = '22023';
  end if;
  -- Mêmes contrôles et même enregistrement que la version à 5 paramètres.
  perform public.save_cotisation_settings(p_url, p_montant, p_libelle, p_ouverture, p_fin);
  insert into public.app_settings (tenant_id, key, value, updated_at)
  values (public.current_tenant_id(), 'cotisation_message', v_message, now())
  on conflict (tenant_id, key)
  do update set value = excluded.value, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.save_cotisation_settings(text, text, text, date, date, text) from public, anon;
grant execute on function public.save_cotisation_settings(text, text, text, date, date, text) to authenticated;
