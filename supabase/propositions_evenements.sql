-- ── Événements proposés par les membres ──────────────────────────────────────────────────────────
-- Dans l'Agenda de l'app, un membre propose un événement, de deux sortes :
--  * « à organiser avec le bureau » (un vide-grenier…) : la proposition devient aussi une idée de
--    la boîte à idées, que les autres peuvent soutenir et commenter ;
--  * « mon événement, à faire connaître » (sa soirée karaoké mensuelle…) : il ira tel quel dans
--    l'Agenda, avec toutes ses séances s'il se répète.
-- Le bureau accepte (un événement de l'Agenda ou une action du Pilotage, à son choix, pour une
-- proposition à organiser) ou ne retient pas, avec un mot. Le membre est prévenu de la réponse.
--
-- Personne n'écrit directement dans la table : tout passe par les fonctions proposer_evenement,
-- accepter_proposition et refuser_proposition, qui vérifient qui fait quoi.
-- Script rejouable sans risque.

-- 1. Les propositions ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.propositions_evenements (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  auteur         uuid not null references public.profiles(id) on delete cascade,
  type           text not null check (type in ('a_organiser', 'personnel')),
  titre          text not null check (length(trim(titre)) between 1 and 120),
  description    text not null check (length(trim(description)) between 1 and 2000),
  periode        text check (periode is null or length(periode) <= 120),  -- « courant mars », à organiser
  date           date,                                                    -- première séance, mon événement
  heure          text check (heure is null or length(heure) <= 40),
  lieu           text check (lieu is null or length(lieu) <= 200),
  repetition     text not null default 'aucune' check (repetition in ('aucune', 'semaine', 'mois')),
  nb_mois        smallint check (nb_mois in (3, 6)),
  idee_id        bigint references public.idees(id) on delete set null,
  statut         text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  mot_du_bureau  text check (mot_du_bureau is null or length(mot_du_bureau) <= 500),
  devenue        text check (devenue in ('evenement', 'action')),
  evenement_id   bigint references public.evenements(id) on delete set null,
  action_id      bigint references public.actions(id) on delete set null,
  decide_par     uuid references public.profiles(id) on delete set null,
  decide_le      timestamptz,
  -- Pour la fonction de notification : le bureau est prévenu d'une nouvelle proposition, l'auteur
  -- de la réponse. Faux = encore à envoyer.
  bureau_prevenu boolean not null default false,
  auteur_prevenu boolean not null default true,
  created_at     timestamptz not null default now(),
  -- Mon événement va tel quel dans l'Agenda : il lui faut une date et un lieu.
  constraint proposition_personnelle_complete check (type = 'a_organiser' or (date is not null and lieu is not null)),
  -- Seul un événement personnel se répète, et toujours pour une durée donnée.
  constraint repetition_coherente check (repetition = 'aucune' or (type = 'personnel' and nb_mois is not null))
);
-- Le nom de l'auteur, noté à l'envoi : un membre du bureau qui n'est pas administrateur ne lit pas
-- les fiches des adhérents, mais doit savoir qui propose.
alter table public.propositions_evenements add column if not exists auteur_nom text;
create index if not exists propositions_evenements_tenant_idx on public.propositions_evenements (tenant_id, statut, created_at desc);
create index if not exists propositions_evenements_auteur_idx on public.propositions_evenements (auteur, created_at desc);
alter table public.propositions_evenements enable row level security;

-- Le membre lit les siennes ; le bureau lit toutes celles de son association.
drop policy if exists "Propositions : l'auteur et le bureau lisent" on public.propositions_evenements;
create policy "Propositions : l'auteur et le bureau lisent" on public.propositions_evenements for select to authenticated
  using (auteur = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()));

-- 2. Ce que les autres membres voient ───────────────────────────────────────────────────────────────
-- Sur l'idée : où en est la proposition (null = une idée ordinaire). Sur l'événement de l'Agenda :
-- « Proposé par Julien », et les séances d'une même série reliées entre elles.
alter table public.idees      add column if not exists proposition_statut text check (proposition_statut in ('en_attente', 'acceptee', 'refusee'));
alter table public.evenements add column if not exists propose_par uuid references public.profiles(id) on delete set null;
alter table public.evenements add column if not exists propose_par_nom text;
alter table public.evenements add column if not exists serie uuid;
create index if not exists evenements_serie_idx on public.evenements (serie) where serie is not null;

-- 3. Les séances d'une série ───────────────────────────────────────────────────────────────────────
-- Chaque semaine ou chaque mois, à partir de la première date, pendant 3 ou 6 mois. « Chaque mois »
-- garde le même jour du mois (le 31 devient le 28 ou le 30 les mois plus courts).
-- Copie fidèle de seancesDeLaSerie (propositions.ts), testée côté app et bureau.
create or replace function public.seances_de_la_serie(p_debut date, p_repetition text, p_nb_mois smallint)
returns setof date language sql immutable as $$
  select (p_debut + case when p_repetition = 'semaine' then n * interval '7 days' else n * interval '1 month' end)::date
    from generate_series(0, 200) as n
   where p_repetition in ('semaine', 'mois')
     and (p_debut + case when p_repetition = 'semaine' then n * interval '7 days' else n * interval '1 month' end)::date
         < (p_debut + p_nb_mois * interval '1 month')::date
  union all
  select p_debut where p_repetition = 'aucune'
  order by 1
$$;

-- 4. Proposer ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.proposer_evenement(
  p_type text, p_titre text, p_description text,
  p_periode text default null, p_date date default null, p_heure text default null, p_lieu text default null,
  p_repetition text default 'aucune', p_nb_mois smallint default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  moi public.profiles;
  nouvelle bigint;
  idee bigint;
begin
  select * into moi from public.profiles where id = auth.uid();
  if moi.id is null or moi.tenant_id is null then
    raise exception 'Connectez-vous pour proposer un événement.' using errcode = 'P0001';
  end if;
  -- Un garde-fou contre l'envoi en rafale, pas une limite pour un membre normal.
  if (select count(*) from public.propositions_evenements where auteur = moi.id and statut = 'en_attente') >= 5 then
    raise exception 'Vous avez déjà 5 propositions en attente : le bureau doit d''abord y répondre.' using errcode = 'P0001';
  end if;
  if p_type = 'personnel' and p_date < (now() at time zone 'Europe/Paris')::date then
    raise exception 'La date de l''événement est déjà passée.' using errcode = 'P0001';
  end if;
  insert into public.propositions_evenements (tenant_id, auteur, auteur_nom, type, titre, description, periode, date, heure, lieu, repetition, nb_mois)
  values (moi.tenant_id, moi.id, nullif(trim(concat_ws(' ', moi.prenom, moi.nom)), ''), p_type, trim(p_titre), trim(p_description), nullif(trim(p_periode), ''), p_date,
          nullif(trim(p_heure), ''), nullif(trim(p_lieu), ''), coalesce(p_repetition, 'aucune'),
          case when coalesce(p_repetition, 'aucune') = 'aucune' then null else p_nb_mois end)
  returning id into nouvelle;
  -- À organiser : l'idée correspondante, que les autres membres peuvent soutenir.
  if p_type = 'a_organiser' then
    insert into public.idees (tenant_id, user_id, prenom, categorie, titre, texte, proposition_statut)
    values (moi.tenant_id, moi.id, nullif(trim(concat_ws(' ', moi.prenom, left(moi.nom, 1) || case when moi.nom is not null then '.' end)), ''),
            'Animations & Événements', trim(p_titre),
            trim(p_description) || case when nullif(trim(p_periode), '') is not null then E'\n\nQuand : ' || trim(p_periode) else '' end,
            'en_attente')
    returning id into idee;
    update public.propositions_evenements set idee_id = idee where id = nouvelle;
  end if;
  return nouvelle;
end $$;

-- 5. Accepter ───────────────────────────────────────────────────────────────────────────────────────
-- Mon événement : publié dans l'Agenda, une ligne par séance. À organiser : un événement de l'Agenda
-- ou une action du Pilotage (p_devenir), à la date que choisit le bureau (p_date).
create or replace function public.accepter_proposition(p_proposition bigint, p_devenir text default null, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
  nom_auteur text;
  la_serie uuid;
  premier bigint;
  nouvelle_action bigint;
  devenir text;
begin
  select * into p from public.propositions_evenements where id = p_proposition for update;
  if p.id is null or p.tenant_id <> public.current_tenant_id() or not public.is_bureau_or_admin() then
    raise exception 'Seul le bureau peut répondre aux propositions.' using errcode = 'P0001';
  end if;
  if p.statut = 'retiree' then
    raise exception 'Son auteur a retiré cette proposition.' using errcode = 'P0001';
  end if;
  if p.statut <> 'en_attente' then
    raise exception 'Le bureau a déjà répondu à cette proposition.' using errcode = 'P0001';
  end if;
  -- Le nom noté à l'envoi, sinon celui de la fiche (« nom_auteur » : « nom » est aussi une colonne).
  select coalesce(p.auteur_nom, nullif(trim(concat_ws(' ', pr.prenom, pr.nom)), '')) into nom_auteur
    from public.profiles pr where pr.id = p.auteur;
  devenir := case when p.type = 'personnel' then 'evenement' else p_devenir end;
  if devenir not in ('evenement', 'action') then
    raise exception 'Choisissez : un événement de l''Agenda ou une action du Pilotage.' using errcode = 'P0001';
  end if;
  if p.type = 'a_organiser' and p_date is null then
    raise exception 'Choisissez la date de l''événement.' using errcode = 'P0001';
  end if;

  if devenir = 'action' then
    insert into public.actions (tenant_id, titre, date_action, referent, statut)
    values (p.tenant_id, p.titre, p_date, auth.uid(), 'À faire')
    returning id into nouvelle_action;
  else
    la_serie := case when p.repetition <> 'aucune' then gen_random_uuid() end;
    with seances as (
      insert into public.evenements (tenant_id, titre, date, heure, lieu, description, participation, propose_par, propose_par_nom, serie)
      select p.tenant_id, p.titre, d, p.heure, p.lieu, p.description, true, p.auteur, nom_auteur, la_serie
        from public.seances_de_la_serie(coalesce(p.date, p_date), p.repetition, p.nb_mois) as d
      returning id, date
    )
    select id into premier from seances order by date limit 1;
  end if;

  update public.propositions_evenements
     set statut = 'acceptee', devenue = devenir, evenement_id = premier, action_id = nouvelle_action,
         decide_par = auth.uid(), decide_le = now(), auteur_prevenu = false
   where id = p.id;
  update public.idees set proposition_statut = 'acceptee' where id = p.idee_id;
  return jsonb_build_object('devenue', devenir, 'evenement_id', premier, 'action_id', nouvelle_action);
end $$;

-- 6. Ne pas retenir ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.refuser_proposition(p_proposition bigint, p_mot text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
begin
  select * into p from public.propositions_evenements where id = p_proposition for update;
  if p.id is null or p.tenant_id <> public.current_tenant_id() or not public.is_bureau_or_admin() then
    raise exception 'Seul le bureau peut répondre aux propositions.' using errcode = 'P0001';
  end if;
  if p.statut = 'retiree' then
    raise exception 'Son auteur a retiré cette proposition.' using errcode = 'P0001';
  end if;
  if p.statut <> 'en_attente' then
    raise exception 'Le bureau a déjà répondu à cette proposition.' using errcode = 'P0001';
  end if;
  update public.propositions_evenements
     set statut = 'refusee', mot_du_bureau = nullif(trim(p_mot), ''), decide_par = auth.uid(), decide_le = now(), auteur_prevenu = false
   where id = p.id;
  update public.idees set proposition_statut = 'refusee' where id = p.idee_id;
end $$;

revoke all on function public.proposer_evenement(text, text, text, text, date, text, text, text, smallint) from public, anon;
revoke all on function public.accepter_proposition(bigint, text, date) from public, anon;
revoke all on function public.refuser_proposition(bigint, text) from public, anon;
grant execute on function public.proposer_evenement(text, text, text, text, date, text, text, text, smallint) to authenticated;
grant execute on function public.accepter_proposition(bigint, text, date) to authenticated;
grant execute on function public.refuser_proposition(bigint, text) to authenticated;
grant execute on function public.seances_de_la_serie(date, text, smallint) to authenticated;

-- 7. Modifier, retirer, et retirer les prochaines séances ────────────────────────────────────────
-- Tant que le bureau n'a pas répondu, l'auteur corrige sa proposition ou la retire (« retiree » :
-- elle disparaît de l'encadré du bureau, et l'idée liée de la boîte à idées). Une fois son
-- événement publié, il peut en retirer les séances à venir (une soirée qui s'arrête).
alter table public.propositions_evenements drop constraint if exists propositions_evenements_statut_check;
alter table public.propositions_evenements add constraint propositions_evenements_statut_check
  check (statut in ('en_attente', 'acceptee', 'refusee', 'retiree'));
alter table public.idees drop constraint if exists idees_proposition_statut_check;
alter table public.idees add constraint idees_proposition_statut_check
  check (proposition_statut in ('en_attente', 'acceptee', 'refusee', 'retiree'));

/** La proposition de l'auteur connecté, encore en attente ; sinon une erreur claire. */
create or replace function public.ma_proposition_en_attente(p_proposition bigint)
returns public.propositions_evenements language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
begin
  select * into p from public.propositions_evenements where id = p_proposition and auteur = auth.uid() for update;
  if p.id is null then
    raise exception 'Cette proposition n''existe plus.' using errcode = 'P0001';
  end if;
  if p.statut = 'retiree' then
    raise exception 'Vous avez retiré cette proposition : elle ne se modifie plus.' using errcode = 'P0001';
  end if;
  if p.statut <> 'en_attente' then
    raise exception 'Le bureau a déjà répondu : elle ne se modifie plus.' using errcode = 'P0001';
  end if;
  return p;
end $$;
revoke all on function public.ma_proposition_en_attente(bigint) from public, anon, authenticated;

create or replace function public.modifier_proposition(
  p_proposition bigint, p_titre text, p_description text,
  p_periode text default null, p_date date default null, p_heure text default null, p_lieu text default null,
  p_repetition text default 'aucune', p_nb_mois smallint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
begin
  p := public.ma_proposition_en_attente(p_proposition);
  if p.type = 'personnel' and p_date < (now() at time zone 'Europe/Paris')::date then
    raise exception 'La date de l''événement est déjà passée.' using errcode = 'P0001';
  end if;
  update public.propositions_evenements
     set titre = trim(p_titre), description = trim(p_description), periode = nullif(trim(p_periode), ''),
         date = p_date, heure = nullif(trim(p_heure), ''), lieu = nullif(trim(p_lieu), ''),
         repetition = coalesce(p_repetition, 'aucune'),
         nb_mois = case when coalesce(p_repetition, 'aucune') = 'aucune' then null else p_nb_mois end
   where id = p.id;
  update public.idees
     set titre = trim(p_titre),
         texte = trim(p_description) || case when nullif(trim(p_periode), '') is not null then E'\n\nQuand : ' || trim(p_periode) else '' end
   where id = p.idee_id;
end $$;

create or replace function public.retirer_proposition(p_proposition bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
begin
  p := public.ma_proposition_en_attente(p_proposition);
  update public.propositions_evenements set statut = 'retiree', decide_le = now() where id = p.id;
  update public.idees set visible = false, proposition_statut = 'retiree' where id = p.idee_id;
end $$;

-- Les séances à venir de son événement publié ; les séances passées restent, pour l'historique.
create or replace function public.retirer_seances_a_venir(p_proposition bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare
  p public.propositions_evenements;
  la_serie uuid;
  retirees integer;
begin
  select * into p from public.propositions_evenements
   where id = p_proposition and auteur = auth.uid() and statut = 'acceptee' and devenue = 'evenement';
  if p.id is null then
    raise exception 'Cet événement n''est pas le vôtre, ou n''est pas publié.' using errcode = 'P0001';
  end if;
  select serie into la_serie from public.evenements where id = p.evenement_id;
  delete from public.evenements
   where propose_par = auth.uid() and date >= (now() at time zone 'Europe/Paris')::date
     and (id = p.evenement_id or (la_serie is not null and serie = la_serie));
  get diagnostics retirees = row_count;
  return retirees;
end $$;

revoke all on function public.modifier_proposition(bigint, text, text, text, date, text, text, text, smallint) from public, anon;
revoke all on function public.retirer_proposition(bigint) from public, anon;
revoke all on function public.retirer_seances_a_venir(bigint) from public, anon;
grant execute on function public.modifier_proposition(bigint, text, text, text, date, text, text, text, smallint) to authenticated;
grant execute on function public.retirer_proposition(bigint) to authenticated;
grant execute on function public.retirer_seances_a_venir(bigint) to authenticated;
