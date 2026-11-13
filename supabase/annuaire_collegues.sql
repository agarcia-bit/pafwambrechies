-- ── Plusieurs personnes d'une même entreprise sur une fiche d'annuaire ───────
-- Une fiche a un titulaire (annuaire.user_id). Le bureau peut y rattacher des collègues : ils ont
-- leur propre compte, mais pas de fiche en double ; ils voient et modifient la fiche de leur
-- entreprise (« Ma fiche annuaire »), et leur nom s'affiche sur la fiche.
--
--   * annuaire_collegues : un collègue par adresse e-mail (il peut ne pas être encore inscrit) ;
--     une personne n'est collègue que d'une seule fiche ; son compte est relié à sa première
--     ouverture de « Ma fiche annuaire » (fiche_de_collegue) ;
--   * ajouter_collegue : le bureau rattache une personne (et l'ajoute à la liste des adhérents à
--     inviter si besoin), en supprimant au passage sa fiche en double s'il le demande ;
--   * retirer_collegue : le bureau détache une personne de la fiche.
-- Peut être relancé sans risque.

create table if not exists public.annuaire_collegues (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  fiche_id   bigint not null references public.annuaire(id) on delete cascade,
  email      text not null check (email = lower(btrim(email)) and email like '%@%'),
  user_id    uuid references auth.users(id) on delete set null,
  prenom     text,
  nom        text,
  created_at timestamptz not null default now(),
  primary key (fiche_id, email),
  unique (tenant_id, email)
);
create index if not exists annuaire_collegues_user_idx on public.annuaire_collegues (user_id);

alter table public.annuaire_collegues enable row level security;

-- Tous les adhérents voient qui fait partie de l'entreprise (noms affichés sur la fiche).
drop policy if exists "Members read tenant collegues" on public.annuaire_collegues;
create policy "Members read tenant collegues"
  on public.annuaire_collegues for select to authenticated
  using (tenant_id = public.current_tenant_id());
-- Pas d'écriture directe : seulement par ajouter_collegue / retirer_collegue (bureau).

-- Un collègue relié modifie la fiche de son entreprise, comme le titulaire.
drop policy if exists "Collegues update their annuaire" on public.annuaire;
create policy "Collegues update their annuaire"
  on public.annuaire for update to authenticated
  using (tenant_id = public.current_tenant_id() and exists (
    select 1 from public.annuaire_collegues c where c.fiche_id = annuaire.id and c.user_id = auth.uid()))
  with check (tenant_id = public.current_tenant_id());

-- ── Le collègue retrouve la fiche de son entreprise ──────────────────────────
create or replace function public.fiche_de_collegue()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_id    bigint;
begin
  if v_uid is null then return null; end if;
  select fiche_id into v_id from public.annuaire_collegues
   where user_id = v_uid and tenant_id = public.current_tenant_id();
  if v_id is not null then return v_id; end if;
  select lower(btrim(email)) into v_email from public.profiles where id = v_uid;
  update public.annuaire_collegues set user_id = v_uid
   where tenant_id = public.current_tenant_id() and email = v_email and user_id is null
  returning fiche_id into v_id;
  return v_id;
end;
$$;
revoke all on function public.fiche_de_collegue() from public, anon;
grant execute on function public.fiche_de_collegue() to authenticated;

-- ── Le bureau rattache ou détache un collègue ────────────────────────────────
create or replace function public.ajouter_collegue(
  p_fiche bigint,
  p_email text,
  p_prenom text,
  p_nom text,
  p_supprimer_sa_fiche boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid := public.current_tenant_id();
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_profile uuid;
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.annuaire where id = p_fiche and tenant_id = v_tenant) then
    raise exception 'fiche_introuvable' using errcode = '22023';
  end if;
  select id into v_profile from public.profiles where tenant_id = v_tenant and lower(btrim(email)) = v_email;

  -- Pas encore de compte : sur la liste des adhérents à inviter, sans fiche à son nom.
  if v_profile is null then
    insert into public.adherents_invites (tenant_id, email, prenom, nom, invited_by)
    values (v_tenant, v_email, nullif(btrim(coalesce(p_prenom, '')), ''), nullif(btrim(coalesce(p_nom, '')), ''), auth.uid())
    on conflict (tenant_id, email) do nothing;
  end if;

  if p_supprimer_sa_fiche then
    delete from public.annuaire
     where tenant_id = v_tenant and id <> p_fiche
       and (user_id = v_profile or (user_id is null and lower(btrim(email)) = v_email));
  end if;

  insert into public.annuaire_collegues (tenant_id, fiche_id, email, user_id, prenom, nom)
  values (v_tenant, p_fiche, v_email, v_profile,
          nullif(btrim(coalesce(p_prenom, '')), ''), nullif(btrim(coalesce(p_nom, '')), ''))
  on conflict (tenant_id, email) do update
    set fiche_id = excluded.fiche_id, user_id = coalesce(excluded.user_id, public.annuaire_collegues.user_id),
        prenom = coalesce(excluded.prenom, public.annuaire_collegues.prenom),
        nom = coalesce(excluded.nom, public.annuaire_collegues.nom);
end;
$$;
revoke all on function public.ajouter_collegue(bigint, text, text, text, boolean) from public, anon;
grant execute on function public.ajouter_collegue(bigint, text, text, text, boolean) to authenticated;

create or replace function public.retirer_collegue(p_fiche bigint, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.annuaire_collegues
   where tenant_id = public.current_tenant_id() and fiche_id = p_fiche and email = lower(btrim(p_email));
end;
$$;
revoke all on function public.retirer_collegue(bigint, text) from public, anon;
grant execute on function public.retirer_collegue(bigint, text) to authenticated;
