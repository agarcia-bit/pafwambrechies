-- ── Self-service signup with a shared access code ───────────────────────────
-- Adds a key/value settings table (with the access code) and a security-definer
-- function so anyone can VERIFY a candidate code without being able to READ it.

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Only admins can read or modify settings. The signup code itself is never
-- exposed to regular clients; signup validation goes through the function
-- defined below, which runs with elevated privileges.
drop policy if exists "Admins can read settings"   on public.app_settings;
drop policy if exists "Admins can insert settings" on public.app_settings;
drop policy if exists "Admins can update settings" on public.app_settings;

create policy "Admins can read settings"
  on public.app_settings for select to authenticated
  using (public.is_admin());

create policy "Admins can insert settings"
  on public.app_settings for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update settings"
  on public.app_settings for update to authenticated
  using (public.is_admin());

-- Seed an initial code; admin can change it from the app afterwards.
insert into public.app_settings (key, value)
values ('signup_code', 'PAF2026')
on conflict (key) do nothing;

-- Validate a candidate signup code. Returns true if it matches the current
-- setting. SECURITY DEFINER so callers can verify without being able to
-- SELECT the value directly.
create or replace function public.validate_signup_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_code text;
begin
  select value into current_code
  from public.app_settings
  where key = 'signup_code';
  return current_code is not null and current_code = p_code;
end;
$$;

revoke all on function public.validate_signup_code(text) from public;
grant execute on function public.validate_signup_code(text) to anon, authenticated;
