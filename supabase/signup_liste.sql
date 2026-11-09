-- ── Inscription réservée à la liste des adhérents ───────────────────────────
-- Avec le réglage « inscription_sur_liste » à 'on', le code d'accès ne suffit plus : l'adresse
-- e-mail doit être sur la liste du bureau (adherents_invites : import, ou « Ajouter et inviter »).
-- Sinon, n'importe qui ayant le code pouvait créer un compte.
--
-- 1. signup_eligibility(code, email) : vérification par l'app avant de créer le compte, pour un
--    message clair. Limitée comme les autres fonctions d'inscription (signup_attempts).
-- 2. handle_new_user : la même règle, côté serveur, que l'app ne peut pas contourner.
-- 3. Le réglage est activé pour PAF Wambrechies ; les autres associations le choisissent dans
--    Réglages > Code d'accès.

create or replace function public.signup_on_list_required(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings s
     where s.tenant_id = p_tenant and s.key = 'inscription_sur_liste' and lower(btrim(s.value)) = 'on'
  );
$$;
revoke all on function public.signup_on_list_required(uuid) from public, anon, authenticated;

-- 'ok' : l'inscription peut continuer ; 'not_on_list' : l'adresse n'est pas sur la liste ;
-- null : code inconnu.
create or replace function public.signup_eligibility(p_code text, p_email text)
returns text
language plpgsql
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
  if not public.signup_on_list_required(v_tenant) then
    return 'ok';
  end if;
  if exists (select 1 from public.adherents_invites i
              where i.tenant_id = v_tenant and i.email = lower(btrim(p_email)) and i.user_id is null) then
    return 'ok';
  end if;
  -- Compte comme un essai : on ne peut pas passer la liste en revue adresse par adresse.
  insert into public.signup_attempts (ip) values (public.client_ip());
  return 'not_on_list';
end;
$$;
revoke all on function public.signup_eligibility(text, text) from public;
grant execute on function public.signup_eligibility(text, text) to anon, authenticated;

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

  -- Inscription réservée à la liste : l'adresse doit y être et ne pas avoir déjà de compte.
  if public.signup_on_list_required(v_tenant) and not exists (
    select 1 from public.adherents_invites i
     where i.tenant_id = v_tenant and i.email = lower(btrim(new.email)) and i.user_id is null
  ) then
    raise exception 'Not on member list';
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

insert into public.app_settings (tenant_id, key, value)
values ('c745e3a3-0f47-43e3-9586-d1d168e21277', 'inscription_sur_liste', 'on')
on conflict (tenant_id, key) do update set value = excluded.value, updated_at = now();
