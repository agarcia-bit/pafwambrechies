-- Backend for the Allianceo native app (single multi-tenant app).
-- Compatible with the existing PAF web app: nothing here changes its behaviour.

-- ── Signup codes identify a tenant, so they must be unique across tenants ──
create unique index if not exists app_settings_signup_code_unique
  on public.app_settings (upper(value))
  where key = 'signup_code';

-- ── Branding of a tenant (internal helper, not callable by clients) ─────────
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
                              'tenant_secondary_color', 'tenant_logo_url', 'tenant_login_bg_url')
            ), '{}'::jsonb)
  from public.tenants t
  where t.id = p_tenant;
$$;
revoke all on function public.branding_for_tenant(uuid) from public, anon, authenticated;

-- ── Signup screen: which association does this code belong to? ─────────────
-- Returns the association's branding, or null for an unknown code.
create or replace function public.resolve_signup_code(p_code text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select s.tenant_id into v_tenant
    from public.app_settings s
    where s.key = 'signup_code' and upper(s.value) = upper(trim(p_code))
    limit 1;
  if v_tenant is null then
    return null;
  end if;
  return public.branding_for_tenant(v_tenant);
end;
$$;
revoke all on function public.resolve_signup_code(text) from public;
grant execute on function public.resolve_signup_code(text) to anon, authenticated;

-- ── Branding of the signed-in user's association ───────────────────────────
create or replace function public.get_my_branding()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select public.branding_for_tenant(public.current_tenant_id());
$$;
revoke all on function public.get_my_branding() from public, anon;
grant execute on function public.get_my_branding() to authenticated;

-- ── Native push tokens (Expo push service: iOS + Android) ──────────────────
create table if not exists public.device_tokens (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_tenant_idx on public.device_tokens (tenant_id);

alter table public.device_tokens enable row level security;
drop policy if exists "Users read own device tokens" on public.device_tokens;
create policy "Users read own device tokens"
  on public.device_tokens for select to authenticated
  using (user_id = auth.uid());
-- Writes go through the functions below: a phone can change hands (logout,
-- login with another account), and RLS would block taking over a token row
-- owned by the previous user.

create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if auth.uid() is null or v_tenant is null then
    raise exception 'Not an association member';
  end if;
  insert into public.device_tokens (tenant_id, user_id, token, platform)
  values (v_tenant, auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set tenant_id = excluded.tenant_id,
        user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;
revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

create or replace function public.unregister_device_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_device_token(text) from public, anon;
grant execute on function public.unregister_device_token(text) to authenticated;

-- ── In-app account deletion (required by Apple) ────────────────────────────
-- auth.users is shared with other apps on this project (e.g. immopilot).
-- If the user has data in another app, only their Allianceo account and
-- content are deleted and the shared login is kept; otherwise the login is
-- deleted too.
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used_elsewhere boolean := false;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and n.nspname not in ('public', 'auth', 'storage')
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_used_elsewhere using v_uid;
    exit when v_used_elsewhere;
  end loop;

  delete from public.device_tokens      where user_id = v_uid;
  delete from public.push_subscriptions where user_id = v_uid;
  delete from public.actus_likes        where user_id = v_uid;
  delete from public.actus_commentaires where user_id = v_uid;
  delete from public.idees_likes        where user_id = v_uid;
  delete from public.idees_commentaires where user_id = v_uid;
  delete from public.idees              where user_id = v_uid;
  delete from public.profiles           where id = v_uid;  -- actions/taches referents are set to null

  if not v_used_elsewhere then
    delete from auth.users where id = v_uid;
  end if;

  return jsonb_build_object('login_deleted', not v_used_elsewhere);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
