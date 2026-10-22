-- ── Tenant branding stored in app_settings, exposed via a public RPC ────────
-- Lets the same code base be rebranded per tenant without touching the source:
-- each tenant Supabase project holds its own name/tagline/color/logo/etc.
--
-- Public callers (anonymous visitors on the login screen) need to see the
-- branding to render correctly. We keep app_settings admin-only for direct
-- reads (the signup code is in there and must not leak), and expose the
-- non-sensitive keys through a SECURITY DEFINER function.

-- Seed the branding rows with the current PAF Wambrechies values.
insert into public.app_settings (key, value)
values
  ('tenant_name',           'PAF Wambrechies'),
  ('tenant_tagline',        'Espace adhérents'),
  ('tenant_primary_color',  '#2E3192'),
  ('tenant_logo_url',       ''),
  ('tenant_login_bg_url',   '')
on conflict (key) do nothing;

-- Returns the public branding as a jsonb object. Anon and authenticated
-- callers can invoke it; direct SELECT on app_settings still requires admin.
create or replace function public.get_public_branding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  r record;
begin
  for r in
    select key, value
    from public.app_settings
    where key in (
      'tenant_name',
      'tenant_tagline',
      'tenant_primary_color',
      'tenant_logo_url',
      'tenant_login_bg_url'
    )
  loop
    result := result || jsonb_build_object(r.key, r.value);
  end loop;
  return result;
end;
$$;

revoke all on function public.get_public_branding() from public;
grant execute on function public.get_public_branding() to anon, authenticated;
