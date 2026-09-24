-- Tenant resolution at signup (applied to the PAF project on 2026-09-24).
--
-- auth.users is shared with other apps on this Supabase project (immopilot).
-- The previous version attached every signup without a tenant to
-- paf-wambrechies, which silently made unrelated users PAF members.
--
-- Resolution order:
--   1. signup_code (authoritative, case-insensitive): unknown code => signup fails
--   2. tenant_slug (legacy web signup)
--   3. neither => no profile is created (not an Allianceo/PAF signup)
-- The signup code is removed from the user's metadata once used.

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
    return new;
  end if;

  insert into public.profiles (id, email, prenom, nom, tenant_id)
  values (new.id, new.email, v_meta->>'prenom', v_meta->>'nom', v_tenant)
  on conflict (id) do nothing;
  return new;
end;
$$;
