-- Membership dues (cotisations): the bureau keeps the list of members who renewed.
--
--   * public.cotisations: one row per member, valide_jusqu = last day the membership is valid.
--     No row = never paid. A member reads their own row; the bureau and admins read all of the
--     association's rows. Nobody writes the table directly: the bureau goes through
--     set_cotisation / clear_cotisation, which check the role and the association;
--   * list_cotisations(): every member of the association with their end date (bureau/admins only,
--     the profiles policy does not let the bureau read other members);
--   * settings (app_settings, per association, not secret): module_cotisations ('on' to enable,
--     absent = off), cotisation_url (payment page, e.g. HelloAsso), cotisation_echeance ("31/08",
--     yearly deadline), cotisation_montant (free text shown to members). They travel with the
--     branding, like the other module settings.
--
-- Deleting an account deletes the member's row (cascade on auth.users).

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
-- Same function as in tenant_app_config.sql, with the four cotisation keys added.
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
                              'module_cotisations', 'cotisation_url',
                              'cotisation_echeance', 'cotisation_montant')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;
