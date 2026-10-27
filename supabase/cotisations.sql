-- Membership dues (cotisations): the bureau keeps the list of members who renewed.
--
--   * public.cotisations: one row per member, valide_jusqu = last day the membership is valid.
--     No row = never paid. A member reads their own row; the bureau and admins read all of the
--     association's rows. Nobody writes the table directly: the bureau goes through
--     set_cotisation / clear_cotisation, which check the role and the association;
--   * list_cotisations(): every member of the association with their end date (bureau/admins only,
--     the profiles policy does not let the bureau read other members);
--   * a renewal CAMPAIGN decided by the bureau: from cotisation_ouverture, the membership
--     "cotisation_libelle" (e.g. 2027) is due, valid until cotisation_fin. Members whose
--     valide_jusqu is before cotisation_fin are asked to renew (banner in the app, one push a
--     week, see cotisations_rappels_cron.sql) until the bureau records their renewal. Without an
--     open campaign nobody is asked anything. save_cotisation_settings() lets the bureau (not only
--     the admins) set the campaign, the payment link and the amount;
--   * settings (app_settings, per association, not secret) travel with the branding, like the
--     other module settings: module_cotisations ('on' to enable, set by an admin, absent = off),
--     cotisation_url (payment page, e.g. HelloAsso), cotisation_montant, cotisation_libelle,
--     cotisation_ouverture, cotisation_fin ("YYYY-MM-DD").
--
-- Deleting an account deletes the member's row (cascade on auth.users). Safe to run again.

create table if not exists public.cotisations (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  valide_jusqu date not null,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.cotisations enable row level security;

drop policy if exists "Read cotisations" on public.cotisations;
create policy "Read cotisations"
  on public.cotisations for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (user_id = auth.uid() or public.is_bureau_or_admin())
  );
-- No insert/update/delete policy on purpose: writes only go through the functions below.

-- ── Bureau: the association's members with their end date ────────────────────
create or replace function public.list_cotisations()
returns table (id uuid, prenom text, nom text, email text, role text, valide_jusqu date)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.prenom, p.nom, p.email, p.role, c.valide_jusqu
  from public.profiles p
  left join public.cotisations c on c.user_id = p.id and c.tenant_id = p.tenant_id
  where public.is_bureau_or_admin()
    and p.tenant_id = public.current_tenant_id()
  order by p.prenom nulls last, p.nom nulls last;
$$;
revoke all on function public.list_cotisations() from public, anon;
grant execute on function public.list_cotisations() to authenticated;

-- ── Bureau: record a renewal / remove the record ─────────────────────────────
create or replace function public.set_cotisation(p_member uuid, p_valide_jusqu date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_valide_jusqu is null then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_member and tenant_id = v_tenant) then
    raise exception 'unknown_member' using errcode = '42501';
  end if;
  insert into public.cotisations (tenant_id, user_id, valide_jusqu, updated_by, updated_at)
  values (v_tenant, p_member, p_valide_jusqu, auth.uid(), now())
  on conflict (tenant_id, user_id)
  do update set valide_jusqu = excluded.valide_jusqu, updated_by = auth.uid(), updated_at = now();
end;
$$;
revoke all on function public.set_cotisation(uuid, date) from public, anon;
grant execute on function public.set_cotisation(uuid, date) to authenticated;

create or replace function public.clear_cotisation(p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.cotisations
  where user_id = p_member and tenant_id = public.current_tenant_id();
end;
$$;
revoke all on function public.clear_cotisation(uuid) from public, anon;
grant execute on function public.clear_cotisation(uuid) to authenticated;

-- ── The settings travel with the branding ────────────────────────────────────
-- Same function as in tenant_app_config.sql, with the cotisation keys added.
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
                              'annuaire_categories', 'offres_categories',
                              'module_cotisations', 'cotisation_url', 'cotisation_montant',
                              'cotisation_libelle', 'cotisation_ouverture', 'cotisation_fin')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;

-- ── Bureau: payment link, amount and renewal campaign ────────────────────────
-- Not limited to admins (app_settings is): the bureau runs the renewals.
create or replace function public.save_cotisation_settings(
  p_url text,
  p_montant text,
  p_libelle text,
  p_ouverture date,
  p_fin date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_url is not null and v_url !~* '^https://' then
    raise exception 'invalid_url' using errcode = '22023';
  end if;
  if (p_ouverture is null) <> (p_fin is null) or (p_fin is not null and p_fin < p_ouverture) then
    raise exception 'invalid_campaign' using errcode = '22023';
  end if;
  insert into public.app_settings (tenant_id, key, value, updated_at)
  values
    (v_tenant, 'cotisation_url',        coalesce(v_url, ''), now()),
    (v_tenant, 'cotisation_montant',    btrim(coalesce(p_montant, '')), now()),
    (v_tenant, 'cotisation_libelle',    btrim(coalesce(p_libelle, '')), now()),
    (v_tenant, 'cotisation_ouverture',  coalesce(p_ouverture::text, ''), now()),
    (v_tenant, 'cotisation_fin',        coalesce(p_fin::text, ''), now())
  on conflict (tenant_id, key)
  do update set value = excluded.value, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.save_cotisation_settings(text, text, text, date, date) from public, anon;
grant execute on function public.save_cotisation_settings(text, text, text, date, date) to authenticated;

-- ── Weekly reminder: who is asked to renew right now ─────────────────────────
-- Called by the notify-cotisations edge function (service_role only). A member is listed when
-- the association has the module on, its campaign is open today (ouverture <= today <= fin)
-- and the member's end date is missing or before the campaign's end date.
create or replace function public.cotisations_a_relancer()
returns table (tenant_id uuid, user_id uuid, libelle text)
language sql
security definer
stable
set search_path = public
as $$
  with today as (select (now() at time zone 'Europe/Paris')::date as d),
  cfg as (
    select s.tenant_id,
           max(case when s.key = 'module_cotisations' then s.value end)                    as module,
           nullif(max(case when s.key = 'cotisation_libelle' then s.value end), '')         as libelle,
           nullif(max(case when s.key = 'cotisation_ouverture' then s.value end), '')::date as ouverture,
           nullif(max(case when s.key = 'cotisation_fin' then s.value end), '')::date       as fin
    from public.app_settings s
    where s.key in ('module_cotisations', 'cotisation_libelle', 'cotisation_ouverture', 'cotisation_fin')
    group by s.tenant_id
  )
  select c.tenant_id, p.id, c.libelle
  from cfg c
  cross join today
  join public.profiles p on p.tenant_id = c.tenant_id
  left join public.cotisations k on k.tenant_id = c.tenant_id and k.user_id = p.id
  where c.module = 'on'
    and c.ouverture is not null and c.fin is not null
    and today.d between c.ouverture and c.fin
    and (k.valide_jusqu is null or k.valide_jusqu < c.fin);
$$;
revoke all on function public.cotisations_a_relancer() from public, anon, authenticated;
grant execute on function public.cotisations_a_relancer() to service_role;
