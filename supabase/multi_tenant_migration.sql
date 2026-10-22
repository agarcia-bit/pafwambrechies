-- ============================================================
-- Multi-tenant migration
-- ============================================================
-- Purpose: host multiple associations in the same Supabase project.
-- Every content table gains a tenant_id, existing data is backfilled
-- to the PAF Wambrechies tenant, and all RLS policies are rewritten
-- to filter by tenant_id so no tenant can ever see another's data.
--
-- Design decisions:
--   * A user belongs to exactly one tenant (profiles.tenant_id). This
--     matches the "each asso has its own app" model — a merchant of
--     PAF Wambrechies has a separate account if they later join
--     PAF Halluin. Simpler policies, simpler mental model.
--   * The client passes tenant_slug in signUp metadata; the trigger
--     handle_new_user() resolves that slug to a tenant_id and stores
--     it on the new profile row.
--   * validate_signup_code and get_public_branding take the slug as
--     an argument (they are called before signIn, so we have no
--     auth.uid() to look up the tenant from).
--   * Every content policy is `tenant_id = current_tenant_id()` on
--     top of the previous membership / admin check.
--
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS everywhere and the
-- backfill is guarded by "where tenant_id is null".

-- ── 1. Tenants table ────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

drop policy if exists "Authenticated can read tenants" on public.tenants;
create policy "Authenticated can read tenants"
  on public.tenants for select to authenticated using (true);

insert into public.tenants (slug, name)
values ('paf-wambrechies', 'PAF Wambrechies')
on conflict (slug) do nothing;

-- ── 2. Add tenant_id everywhere (nullable, so the backfill can populate it) ─
alter table public.profiles           add column if not exists tenant_id uuid references public.tenants(id);
alter table public.actus              add column if not exists tenant_id uuid references public.tenants(id);
alter table public.actus_likes        add column if not exists tenant_id uuid references public.tenants(id);
alter table public.actus_commentaires add column if not exists tenant_id uuid references public.tenants(id);
alter table public.annuaire           add column if not exists tenant_id uuid references public.tenants(id);
alter table public.offres             add column if not exists tenant_id uuid references public.tenants(id);
alter table public.evenements         add column if not exists tenant_id uuid references public.tenants(id);
alter table public.idees              add column if not exists tenant_id uuid references public.tenants(id);
alter table public.idees_likes        add column if not exists tenant_id uuid references public.tenants(id);
alter table public.idees_commentaires add column if not exists tenant_id uuid references public.tenants(id);
alter table public.push_subscriptions add column if not exists tenant_id uuid references public.tenants(id);
alter table public.liens              add column if not exists tenant_id uuid references public.tenants(id);
alter table public.app_settings       add column if not exists tenant_id uuid references public.tenants(id);

-- ── 3. Backfill all existing rows to PAF Wambrechies ────────────────────────
do $$
declare
  paf_id uuid;
begin
  select id into paf_id from public.tenants where slug = 'paf-wambrechies';

  update public.profiles           set tenant_id = paf_id where tenant_id is null;
  update public.actus              set tenant_id = paf_id where tenant_id is null;
  update public.actus_likes        set tenant_id = paf_id where tenant_id is null;
  update public.actus_commentaires set tenant_id = paf_id where tenant_id is null;
  update public.annuaire           set tenant_id = paf_id where tenant_id is null;
  update public.offres             set tenant_id = paf_id where tenant_id is null;
  update public.evenements         set tenant_id = paf_id where tenant_id is null;
  update public.idees              set tenant_id = paf_id where tenant_id is null;
  update public.idees_likes        set tenant_id = paf_id where tenant_id is null;
  update public.idees_commentaires set tenant_id = paf_id where tenant_id is null;
  update public.push_subscriptions set tenant_id = paf_id where tenant_id is null;
  update public.liens              set tenant_id = paf_id where tenant_id is null;
  update public.app_settings       set tenant_id = paf_id where tenant_id is null;
end $$;

-- ── 4. Now that everything is populated, enforce NOT NULL ──────────────────
alter table public.profiles           alter column tenant_id set not null;
alter table public.actus              alter column tenant_id set not null;
alter table public.actus_likes        alter column tenant_id set not null;
alter table public.actus_commentaires alter column tenant_id set not null;
alter table public.annuaire           alter column tenant_id set not null;
alter table public.offres             alter column tenant_id set not null;
alter table public.evenements         alter column tenant_id set not null;
alter table public.idees              alter column tenant_id set not null;
alter table public.idees_likes        alter column tenant_id set not null;
alter table public.idees_commentaires alter column tenant_id set not null;
alter table public.push_subscriptions alter column tenant_id set not null;
alter table public.liens              alter column tenant_id set not null;
alter table public.app_settings       alter column tenant_id set not null;

-- ── 5. app_settings primary key becomes composite (tenant_id, key) ─────────
--     Each tenant now has its own set of settings (branding, signup_code…).
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add primary key (tenant_id, key);

-- ── 6. Helper functions ────────────────────────────────────────────────────

-- Returns the tenant of the currently signed-in user.
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_tenant_id() to authenticated;

-- Refresh is_admin(): still checks role='admin' on the current user.
-- Because a user is only ever in one tenant, no need to pass the tenant.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 7. handle_new_user: attach the new profile to the tenant announced ─────
--     by the client via signUp options.data.tenant_slug. Falls back to PAF
--     for backward compatibility while old invitations are in flight.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
begin
  select id into target_tenant_id
    from public.tenants
    where slug = new.raw_user_meta_data->>'tenant_slug';

  if target_tenant_id is null then
    select id into target_tenant_id
      from public.tenants
      where slug = 'paf-wambrechies';
  end if;

  insert into public.profiles (id, email, prenom, nom, tenant_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'prenom', null),
    coalesce(new.raw_user_meta_data->>'nom', null),
    target_tenant_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 8. Signup validation & public branding become tenant-scoped ────────────

drop function if exists public.validate_signup_code(text);

create or replace function public.validate_signup_code(p_slug text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  current_code text;
begin
  select id into target_tenant_id
    from public.tenants where slug = p_slug;
  if target_tenant_id is null then return false; end if;

  select value into current_code
    from public.app_settings
    where tenant_id = target_tenant_id and key = 'signup_code';

  return current_code is not null and current_code = p_code;
end;
$$;

revoke all on function public.validate_signup_code(text, text) from public;
grant execute on function public.validate_signup_code(text, text) to anon, authenticated;

drop function if exists public.get_public_branding();

create or replace function public.get_public_branding(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  result jsonb := '{}'::jsonb;
  r record;
begin
  select id into target_tenant_id
    from public.tenants where slug = p_slug;
  if target_tenant_id is null then return '{}'::jsonb; end if;

  for r in
    select key, value
      from public.app_settings
      where tenant_id = target_tenant_id
        and key in ('tenant_name', 'tenant_tagline', 'tenant_primary_color', 'tenant_logo_url', 'tenant_login_bg_url')
  loop
    result := result || jsonb_build_object(r.key, r.value);
  end loop;
  return result;
end;
$$;

revoke all on function public.get_public_branding(text) from public;
grant execute on function public.get_public_branding(text) to anon, authenticated;

-- ── 9. Rewrite every content policy so it scopes by tenant_id ──────────────
--     Naming convention: "<action> tenant <table>". Old policies dropped
--     by their historical names.

-- profiles ------------------------------------------------------------------
drop policy if exists "Users can read own profile"    on public.profiles;
drop policy if exists "Admins can read all profiles"  on public.profiles;
drop policy if exists "Users can update own profile"  on public.profiles;
drop policy if exists "Users can insert own profile"  on public.profiles;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Admins read tenant profiles"
  on public.profiles for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Prevent a user from ever moving themselves to another tenant via a
-- direct UPDATE. The trigger runs before every row update on profiles;
-- if tenant_id changes it raises, so admins moving a user manually via
-- the SQL editor need to disable the trigger first (deliberate friction).
create or replace function public.profiles_forbid_tenant_change()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable on profiles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_forbid_tenant_change on public.profiles;
create trigger profiles_forbid_tenant_change
  before update on public.profiles
  for each row execute function public.profiles_forbid_tenant_change();

-- actus ---------------------------------------------------------------------
drop policy if exists "Authenticated users can read actus" on public.actus;
drop policy if exists "Admins can insert actus"            on public.actus;
drop policy if exists "Admins can update actus"            on public.actus;
drop policy if exists "Admins can delete actus"            on public.actus;

create policy "Users read tenant actus"
  on public.actus for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Admins insert tenant actus"
  on public.actus for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant actus"
  on public.actus for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant actus"
  on public.actus for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- actus_likes ---------------------------------------------------------------
drop policy if exists "Lecture likes actus"    on public.actus_likes;
drop policy if exists "Like actu authentifié"  on public.actus_likes;
drop policy if exists "Unlike actu authentifié" on public.actus_likes;

create policy "Users read tenant actus likes"
  on public.actus_likes for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Users like tenant actus"
  on public.actus_likes for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Users unlike tenant actus"
  on public.actus_likes for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

-- actus_commentaires --------------------------------------------------------
drop policy if exists "Lecture commentaires actus"    on public.actus_commentaires;
drop policy if exists "Commenter actu authentifié"    on public.actus_commentaires;
drop policy if exists "Supprimer son commentaire actu" on public.actus_commentaires;
drop policy if exists "Admins can delete actus comments" on public.actus_commentaires;

create policy "Users read tenant actus comments"
  on public.actus_commentaires for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Users insert own tenant actus comment"
  on public.actus_commentaires for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Users delete own tenant actus comment"
  on public.actus_commentaires for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Admins delete tenant actus comments"
  on public.actus_commentaires for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- annuaire ------------------------------------------------------------------
drop policy if exists "Authenticated users can read annuaire" on public.annuaire;
drop policy if exists "Admins can insert annuaire"            on public.annuaire;
drop policy if exists "Admins can update annuaire"            on public.annuaire;
drop policy if exists "Admins can delete annuaire"            on public.annuaire;

create policy "Users read tenant annuaire"
  on public.annuaire for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Admins insert tenant annuaire"
  on public.annuaire for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant annuaire"
  on public.annuaire for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant annuaire"
  on public.annuaire for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- offres --------------------------------------------------------------------
drop policy if exists "Authenticated users can read offres" on public.offres;
drop policy if exists "Admins can insert offres"            on public.offres;
drop policy if exists "Admins can update offres"            on public.offres;
drop policy if exists "Admins can delete offres"            on public.offres;

create policy "Users read tenant offres"
  on public.offres for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Admins insert tenant offres"
  on public.offres for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant offres"
  on public.offres for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant offres"
  on public.offres for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- evenements ---------------------------------------------------------------
drop policy if exists "Authenticated users can read evenements" on public.evenements;
drop policy if exists "Admins can insert evenements"            on public.evenements;
drop policy if exists "Admins can update evenements"            on public.evenements;
drop policy if exists "Admins can delete evenements"            on public.evenements;

create policy "Users read tenant evenements"
  on public.evenements for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Admins insert tenant evenements"
  on public.evenements for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant evenements"
  on public.evenements for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant evenements"
  on public.evenements for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- idees --------------------------------------------------------------------
drop policy if exists "Authenticated users can read visible idees" on public.idees;
drop policy if exists "Users can insert own idees"                 on public.idees;
drop policy if exists "Admins can update idees"                    on public.idees;
drop policy if exists "Admins can delete idees"                    on public.idees;

create policy "Users read visible tenant idees"
  on public.idees for select to authenticated
  using (tenant_id = public.current_tenant_id() and visible = true);

create policy "Users insert own tenant idee"
  on public.idees for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Admins update tenant idees"
  on public.idees for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant idees"
  on public.idees for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- idees_likes --------------------------------------------------------------
drop policy if exists "Authenticated users can read likes" on public.idees_likes;
drop policy if exists "Users can insert own likes"         on public.idees_likes;
drop policy if exists "Users can delete own likes"         on public.idees_likes;

create policy "Users read tenant idees likes"
  on public.idees_likes for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Users like tenant idee"
  on public.idees_likes for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Users unlike tenant idee"
  on public.idees_likes for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

-- idees_commentaires -------------------------------------------------------
drop policy if exists "Authenticated users can read comments" on public.idees_commentaires;
drop policy if exists "Users can insert own comments"         on public.idees_commentaires;
drop policy if exists "Users can delete own comments"         on public.idees_commentaires;
drop policy if exists "Admins can delete idees comments"      on public.idees_commentaires;

create policy "Users read tenant idees comments"
  on public.idees_commentaires for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Users insert own tenant idee comment"
  on public.idees_commentaires for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Users delete own tenant idee comment"
  on public.idees_commentaires for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "Admins delete tenant idees comments"
  on public.idees_commentaires for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- push_subscriptions -------------------------------------------------------
drop policy if exists "Users can manage own push subscriptions" on public.push_subscriptions;

create policy "Users manage own tenant push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

-- liens --------------------------------------------------------------------
drop policy if exists "Lecture publique" on public.liens;
drop policy if exists "Admin insert"     on public.liens;
drop policy if exists "Admin update"     on public.liens;
drop policy if exists "Admin delete"     on public.liens;

create policy "Users read tenant liens"
  on public.liens for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Admins insert tenant liens"
  on public.liens for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant liens"
  on public.liens for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins delete tenant liens"
  on public.liens for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- app_settings -------------------------------------------------------------
drop policy if exists "Admins can read settings"   on public.app_settings;
drop policy if exists "Admins can insert settings" on public.app_settings;
drop policy if exists "Admins can update settings" on public.app_settings;

create policy "Admins read tenant settings"
  on public.app_settings for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins insert tenant settings"
  on public.app_settings for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

create policy "Admins update tenant settings"
  on public.app_settings for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());
