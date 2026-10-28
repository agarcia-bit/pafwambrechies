-- Import of the members' list and invitations.
--
--   * public.adherents_invites: the members a bureau member or an admin imported (first name,
--     last name, e-mail, optionally the end date of their dues). One row per association and
--     e-mail. The bureau and admins read their association's rows; nobody writes the table
--     directly (importer_adherents / retirer_invitation do, after checking the role).
--   * importer_adherents(rows): for each row, a person who already has an account in the
--     association only gets their dues updated (never lowered); anyone else is added to the list.
--   * When someone creates their account with the association's code and the same e-mail as a
--     row of the list, handle_new_user marks the row as joined and records their dues, so the
--     bureau sees who joined and the member starts with the right status.
--   * get_signup_code(): the access code, for the bureau (not only the admins) so that it can be
--     put in the invitation message.
--
-- Affects only Allianceo's tables (tenant_id). handle_new_user is the same function as in
-- signup_tenant_resolution.sql with the "invitation" step added after the profile is created.
-- Safe to run again.

create table if not exists public.adherents_invites (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text not null check (email = lower(btrim(email))),
  prenom       text,
  nom          text,
  valide_jusqu date,
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  user_id      uuid references auth.users(id) on delete set null,
  joined_at    timestamptz,
  primary key (tenant_id, email)
);
alter table public.adherents_invites enable row level security;

drop policy if exists "Bureau reads invites" on public.adherents_invites;
create policy "Bureau reads invites"
  on public.adherents_invites for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());
-- No insert/update/delete policy on purpose: writes only go through the functions below.

-- ── Import ───────────────────────────────────────────────────────────────────
-- p_rows: [{ "email": "...", "prenom": "...", "nom": "...", "valide_jusqu": "YYYY-MM-DD" }, ...]
-- Returns { invites, deja_inscrits, cotisations, ignores }.
create or replace function public.importer_adherents(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid := public.current_tenant_id();
  r         jsonb;
  v_email   text;
  v_date    date;
  v_profile uuid;
  n_invites int := 0;
  n_deja    int := 0;
  n_cotis   int := 0;
  n_ignores int := 0;
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := lower(btrim(coalesce(r->>'email', '')));
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      n_ignores := n_ignores + 1;
      continue;
    end if;
    begin
      v_date := nullif(btrim(coalesce(r->>'valide_jusqu', '')), '')::date;
    exception when others then
      v_date := null;
    end;

    select p.id into v_profile
      from public.profiles p
      where p.tenant_id = v_tenant and lower(btrim(p.email)) = v_email
      limit 1;

    if v_profile is not null then
      -- Already a member: only the dues can change, and never to an earlier date.
      n_deja := n_deja + 1;
      if v_date is not null then
        insert into public.cotisations (tenant_id, user_id, valide_jusqu, updated_by, updated_at)
        values (v_tenant, v_profile, v_date, auth.uid(), now())
        on conflict (tenant_id, user_id) do update
          set valide_jusqu = greatest(public.cotisations.valide_jusqu, excluded.valide_jusqu),
              updated_by = auth.uid(),
              updated_at = now();
        n_cotis := n_cotis + 1;
      end if;
    else
      insert into public.adherents_invites (tenant_id, email, prenom, nom, valide_jusqu, invited_by)
      values (v_tenant, v_email,
              nullif(btrim(coalesce(r->>'prenom', '')), ''),
              nullif(btrim(coalesce(r->>'nom', '')), ''),
              v_date, auth.uid())
      on conflict (tenant_id, email) do update
        set prenom = coalesce(excluded.prenom, public.adherents_invites.prenom),
            nom = coalesce(excluded.nom, public.adherents_invites.nom),
            valide_jusqu = coalesce(excluded.valide_jusqu, public.adherents_invites.valide_jusqu)
        where public.adherents_invites.user_id is null;
      n_invites := n_invites + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'invites', n_invites, 'deja_inscrits', n_deja, 'cotisations', n_cotis, 'ignores', n_ignores
  );
end;
$$;
revoke all on function public.importer_adherents(jsonb) from public, anon;
grant execute on function public.importer_adherents(jsonb) to authenticated;

-- ── Remove someone who has not joined yet ────────────────────────────────────
create or replace function public.retirer_invitation(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.adherents_invites
  where tenant_id = public.current_tenant_id()
    and email = lower(btrim(p_email))
    and user_id is null;
end;
$$;
revoke all on function public.retirer_invitation(text) from public, anon;
grant execute on function public.retirer_invitation(text) to authenticated;

-- ── The access code, for the invitation message ──────────────────────────────
create or replace function public.get_signup_code()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select s.value
  from public.app_settings s
  where public.is_bureau_or_admin()
    and s.tenant_id = public.current_tenant_id()
    and s.key = 'signup_code';
$$;
revoke all on function public.get_signup_code() from public, anon;
grant execute on function public.get_signup_code() to authenticated;

-- ── Signup: link the new account to the list ─────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := nullif(trim(v_meta->>'signup_code'), '');
  v_slug text := nullif(trim(v_meta->>'tenant_slug'), '');
  v_tenant uuid;
  v_slug_tenant uuid;
  v_valide date;
begin
  if v_code is not null then
    select s.tenant_id into v_tenant
      from public.app_settings s
      where s.key = 'signup_code' and upper(s.value) = upper(v_code)
      limit 1;
    if v_tenant is null then
      raise exception 'Invalid signup code';
    end if;
    if v_slug is not null then
      select t.id into v_slug_tenant from public.tenants t where t.slug = v_slug;
      if v_slug_tenant is distinct from v_tenant then
        raise exception 'Signup code does not match tenant';
      end if;
    end if;
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'signup_code' where id = new.id;
  elsif v_slug is not null then
    select t.id into v_tenant from public.tenants t where t.slug = v_slug;
  end if;

  if v_tenant is null then
    return new;  -- not an Allianceo/PAF signup (e.g. another app sharing auth)
  end if;

  insert into public.profiles (id, email, prenom, nom, tenant_id)
  values (new.id, new.email, v_meta->>'prenom', v_meta->>'nom', v_tenant)
  on conflict (id) do nothing;

  -- The member is on the bureau's list: mark them as joined and start their dues.
  update public.adherents_invites i
     set user_id = new.id, joined_at = now()
   where i.tenant_id = v_tenant
     and i.email = lower(btrim(new.email))
     and i.user_id is null
  returning i.valide_jusqu into v_valide;
  if v_valide is not null then
    insert into public.cotisations (tenant_id, user_id, valide_jusqu)
    values (v_tenant, new.id, v_valide)
    on conflict (tenant_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
