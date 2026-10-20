-- Platform owner ("Agalumy"): an account that administers EVERY association and can switch
-- between them from the app, without having a second account.
--
-- How it works: every access rule of the app relies on current_tenant_id() and is_admin()
-- / is_bureau_or_admin(). For a platform admin who picked an association, these three answer
-- for the PICKED association and treat the account as its administrator, so no policy needs
-- to change. The pick is stored per login session (the web app, signed in separately, keeps
-- working on the account's own association) and can be changed or cancelled at any time.
--
--   * platform_admins: who is a platform owner (nobody can read or write it from the app;
--     add rows from the SQL editor only);
--   * platform_context: the association each owner session currently looks at;
--   * switch_tenant(slug), list_my_tenants(), my_context(): used by the app.
--
-- current_tenant_id() / is_admin() / is_bureau_or_admin() are replaced with the same rules
-- plus the platform case: for everybody who is not a platform admin, nothing changes.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create table if not exists public.platform_context (
  user_id    uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.platform_context enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- The association a platform admin picked in THIS session (null for everybody else).
create or replace function public.platform_tenant()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.tenant_id
  from public.platform_context c
  where c.user_id = auth.uid()
    and c.session_id = coalesce(auth.jwt() ->> 'session_id', '')
    and exists (select 1 from public.platform_admins a where a.user_id = c.user_id);
$$;
revoke all on function public.platform_tenant() from public, anon, authenticated;

create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    public.platform_tenant(),
    (select tenant_id from public.profiles where id = auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.platform_tenant() is not null
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_bureau_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.platform_tenant() is not null
      or exists (select 1 from public.profiles where id = auth.uid() and role in ('bureau', 'admin'));
$$;

-- ── What the app uses ────────────────────────────────────────────────────────
create or replace function public.my_context()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'tenant_id', public.current_tenant_id(),
    'role', case when public.platform_tenant() is not null then 'admin'
                 else (select role from public.profiles where id = auth.uid()) end,
    'is_platform_admin', public.is_platform_admin()
  );
$$;
revoke all on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;

create or replace function public.list_my_tenants()
returns table (id uuid, slug text, name text, is_current boolean)
language sql
security definer
stable
set search_path = public
as $$
  select t.id, t.slug, t.name, t.id = public.current_tenant_id()
  from public.tenants t
  where public.is_platform_admin()
  order by t.name;
$$;
revoke all on function public.list_my_tenants() from public, anon;
grant execute on function public.list_my_tenants() to authenticated;

create or replace function public.switch_tenant(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_own    uuid;
  v_sess   text := coalesce(auth.jwt() ->> 'session_id', '');
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Reserved to platform administrators' using errcode = '42501';
  end if;
  select id into v_tenant from public.tenants where slug = p_slug;
  if v_tenant is null then
    raise exception 'Unknown association';
  end if;
  select tenant_id into v_own from public.profiles where id = auth.uid();

  delete from public.platform_context where updated_at < now() - interval '60 days';
  if v_tenant = v_own then
    delete from public.platform_context where user_id = auth.uid() and session_id = v_sess;
  else
    insert into public.platform_context (user_id, session_id, tenant_id)
    values (auth.uid(), v_sess, v_tenant)
    on conflict (user_id, session_id) do update set tenant_id = excluded.tenant_id, updated_at = now();
  end if;
  return public.my_context();
end;
$$;
revoke all on function public.switch_tenant(text) from public, anon;
grant execute on function public.switch_tenant(text) to authenticated;
