-- Limits the attempts at guessing an association's signup code.
--
-- resolve_signup_code() (the app) and validate_signup_code() (the PAF web app) can be called
-- by anybody, without an account: nothing stopped a script from trying codes. Now a caller (by
-- IP address) who gets the code wrong 8 times within 15 minutes is refused ("too_many_attempts")
-- for the rest of that time. The attempts are forgotten after a day.
--
-- Both functions keep their answers (branding / true / false); they now write the failed attempts,
-- so they are no longer "stable". Only touches the signup code check: nothing else.

create table if not exists public.signup_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index if not exists signup_attempts_ip_idx on public.signup_attempts (ip, created_at desc);
alter table public.signup_attempts enable row level security;  -- no policy: only these functions write it

-- The caller's address as the API gateway forwards it.
create or replace function public.client_ip()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
$$;

create or replace function public.signup_attempts_exceeded()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := public.client_ip();
begin
  delete from public.signup_attempts where created_at < now() - interval '1 day';
  return (select count(*) from public.signup_attempts where ip = v_ip and created_at > now() - interval '15 minutes') >= 8;
end;
$$;
revoke all on function public.signup_attempts_exceeded() from public, anon, authenticated;

create or replace function public.resolve_signup_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if public.signup_attempts_exceeded() then
    raise exception 'too_many_attempts';
  end if;
  select s.tenant_id into v_tenant
    from public.app_settings s
    where s.key = 'signup_code' and upper(s.value) = upper(trim(p_code))
    limit 1;
  if v_tenant is null then
    insert into public.signup_attempts (ip) values (public.client_ip());
    return null;
  end if;
  return public.branding_for_tenant(v_tenant);
end;
$$;

create or replace function public.validate_signup_code(p_slug text, p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  current_code text;
  ok boolean;
begin
  if public.signup_attempts_exceeded() then
    raise exception 'too_many_attempts';
  end if;
  select id into target_tenant_id from public.tenants where slug = p_slug;
  if target_tenant_id is null then
    insert into public.signup_attempts (ip) values (public.client_ip());
    return false;
  end if;
  select value into current_code
    from public.app_settings
    where tenant_id = target_tenant_id and key = 'signup_code';
  ok := current_code is not null and current_code = p_code;
  if not ok then
    insert into public.signup_attempts (ip) values (public.client_ip());
  end if;
  return ok;
end;
$$;
