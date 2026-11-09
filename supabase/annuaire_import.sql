-- ── L'annuaire suit la liste des adhérents ──────────────────────────────────
-- Chaque adhérent importé a sa fiche d'annuaire, visible tout de suite dans l'app, préremplie
-- avec ce que le tableau contenait (entreprise, activité, téléphone, adresse…). À son inscription,
-- la fiche lui revient : il n'a plus qu'à ajouter sa photo dans « Ma fiche ».
--
--   * preparer_fiche_annuaire : crée la fiche, ou complète ses cases vides ; un import ne
--     remplace jamais ce que l'adhérent ou le bureau a déjà écrit ;
--   * importer_adherents : appelle preparer_fiche_annuaire pour chaque ligne et compte les fiches ;
--   * handle_new_user : rattache la fiche au nouveau compte par son adresse e-mail (sans attendre
--     l'ouverture de « Ma fiche », que claim_ma_fiche continue de couvrir).
-- Peut être relancé sans risque.

create or replace function public.preparer_fiche_annuaire(
  p_tenant uuid, p_email text, p_prenom text, p_nom text, p_fiche jsonb, p_user uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fiche jsonb := coalesce(p_fiche, '{}'::jsonb);
  v_champ text;
  v_vals  jsonb := '{}'::jsonb;
  v_nom   text := nullif(btrim(concat_ws(' ', nullif(btrim(p_prenom), ''), nullif(btrim(p_nom), ''))), '');
  v_id    bigint;
begin
  -- Seulement des textes non vides, et rien d'autre que les champs prévus.
  foreach v_champ in array array['entreprise', 'categorie', 'telephone', 'adresse', 'description', 'linkedin', 'instagram'] loop
    if nullif(btrim(coalesce(v_fiche->>v_champ, '')), '') is not null then
      v_vals := v_vals || jsonb_build_object(v_champ, left(btrim(v_fiche->>v_champ), 500));
    end if;
  end loop;

  -- Une fiche existe déjà pour cette adresse (une seule, sinon on ne sait pas laquelle compléter).
  select a.id into v_id
    from public.annuaire a
   where a.tenant_id = p_tenant and lower(btrim(a.email)) = p_email
     and (select count(*) from public.annuaire b where b.tenant_id = p_tenant and lower(btrim(b.email)) = p_email) = 1;

  if v_id is not null then
    update public.annuaire a set
      nom_entreprise = case when a.nom_entreprise = coalesce(v_nom, '') or btrim(a.nom_entreprise) = ''
                            then coalesce(v_vals->>'entreprise', a.nom_entreprise) else a.nom_entreprise end,
      categorie      = case when a.categorie in ('', 'Général') then coalesce(v_vals->>'categorie', a.categorie) else a.categorie end,
      telephone      = coalesce(nullif(btrim(a.telephone), ''), v_vals->>'telephone'),
      adresse        = coalesce(nullif(btrim(a.adresse), ''), v_vals->>'adresse'),
      description    = coalesce(nullif(btrim(a.description), ''), v_vals->>'description'),
      linkedin       = coalesce(nullif(btrim(a.linkedin), ''), v_vals->>'linkedin'),
      instagram      = coalesce(nullif(btrim(a.instagram), ''), v_vals->>'instagram'),
      prenom_contact = coalesce(nullif(btrim(a.prenom_contact), ''), nullif(btrim(p_prenom), '')),
      nom_contact    = coalesce(nullif(btrim(a.nom_contact), ''), nullif(btrim(p_nom), '')),
      user_id        = coalesce(a.user_id, p_user)
    where a.id = v_id;
    return false;
  end if;

  if exists (select 1 from public.annuaire a where a.tenant_id = p_tenant and lower(btrim(a.email)) = p_email) then
    return false;  -- plusieurs fiches avec cette adresse : le bureau tranche à la main
  end if;
  -- Une fiche par compte : celui qui en a déjà une (sous une autre adresse) n'en reçoit pas d'autre.
  if p_user is not null and exists (select 1 from public.annuaire a where a.tenant_id = p_tenant and a.user_id = p_user) then
    return false;
  end if;

  insert into public.annuaire (tenant_id, user_id, email, nom_entreprise, categorie, telephone, adresse,
                               description, linkedin, instagram, prenom_contact, nom_contact)
  values (p_tenant, p_user, p_email,
          coalesce(v_vals->>'entreprise', v_nom, p_email),
          coalesce(v_vals->>'categorie', 'Général'),
          v_vals->>'telephone', v_vals->>'adresse', v_vals->>'description', v_vals->>'linkedin', v_vals->>'instagram',
          nullif(btrim(p_prenom), ''), nullif(btrim(p_nom), ''));
  return true;
end;
$$;
revoke all on function public.preparer_fiche_annuaire(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;

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
  n_fiches  int := 0;
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

    -- La fiche d'annuaire, pour un inscrit comme pour un invité.
    if public.preparer_fiche_annuaire(v_tenant, v_email, r->>'prenom', r->>'nom', r->'fiche', v_profile) then
      n_fiches := n_fiches + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'invites', n_invites, 'deja_inscrits', n_deja, 'cotisations', n_cotis, 'ignores', n_ignores, 'fiches', n_fiches
  );
end;
$$;
revoke all on function public.importer_adherents(jsonb) from public, anon;
grant execute on function public.importer_adherents(jsonb) to authenticated;

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
  v_email text := lower(btrim(new.email));
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
     where i.tenant_id = v_tenant and i.email = v_email and i.user_id is null
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
     and i.email = v_email
     and i.user_id is null
  returning i.valide_jusqu into v_valide;
  if v_valide is not null then
    insert into public.cotisations (tenant_id, user_id, valide_jusqu)
    values (v_tenant, new.id, v_valide)
    on conflict (tenant_id, user_id) do nothing;
  end if;

  -- Sa fiche d'annuaire préparée à l'import lui revient (seulement si l'adresse est sans ambiguïté).
  update public.annuaire a
     set user_id = new.id
   where a.tenant_id = v_tenant and a.user_id is null and lower(btrim(a.email)) = v_email
     and (select count(*) from public.annuaire b where b.tenant_id = v_tenant and lower(btrim(b.email)) = v_email) = 1
     and not exists (select 1 from public.annuaire c where c.tenant_id = v_tenant and c.user_id = new.id);
  return new;
end;
$$;
