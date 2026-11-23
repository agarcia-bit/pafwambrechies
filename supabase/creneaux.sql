-- ── Créneaux de présence d'une action du Pilotage ───────────────────────────────────────────────
-- Exemple : le « Marché de Noël » a trois pôles (stand, gaufres, café), chacun avec un nombre de
-- personnes en même temps, sur les mêmes horaires découpés en tranches (10 h → 20 h, par 2 h).
--
--   * actions : quatre colonnes de plus. Les horaires et la durée des tranches sont communs à
--     tous les pôles ; « ouvert aux membres » rend le planning visible aux adhérents dans l'app.
--   * poles : les pôles d'une action, et combien de personnes il faut en même temps. Un pôle peut
--     demander un autre nombre sur une tranche précise (0 le matin pour un café de l'après-midi).
--   * inscriptions_creneaux : qui vient, sur quel pôle et à quelle heure. Une désinscription
--     garde la ligne (annulee_le) pour que notify-taches prévienne les responsables.
--
-- Le bureau lit et écrit tout, comme pour les actions. Un adhérent ne lit jamais ces tables : il
-- passe par trois fonctions qui ne montrent que les actions ouvertes, le nombre de places et ses
-- propres créneaux (ni budget, ni tâches, ni le nom des autres).
-- Le nombre de places est vérifié par la base elle-même, sous verrou : deux personnes qui touchent
-- la dernière place au même instant ne peuvent pas la prendre toutes les deux.
-- Un adhérent qui ne peut plus venir peut chercher un remplaçant (section 9) : sa place reste à son
-- nom, « à reprendre » pour les autres, jusqu'à ce que quelqu'un la prenne.
-- Script rejouable sans risque.

-- 1. Les horaires de l'action ─────────────────────────────────────────────────────────────────────
alter table public.actions
  add column if not exists ouvert_aux_membres boolean not null default false,
  add column if not exists creneau_debut time,
  add column if not exists creneau_fin time,
  add column if not exists creneau_duree_minutes integer;

alter table public.actions drop constraint if exists actions_creneaux_valides;
alter table public.actions add constraint actions_creneaux_valides check (
  (creneau_debut is null and creneau_fin is null and creneau_duree_minutes is null)
  or (creneau_debut < creneau_fin and creneau_duree_minutes between 15 and 720)
);

-- 2. Les pôles ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.poles (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  action_id   bigint not null references public.actions(id) on delete cascade,
  nom         text not null check (length(trim(nom)) between 1 and 80),
  personnes   integer not null default 1 check (personnes between 0 and 50),
  -- Exceptions par tranche, sous la forme {"10:00": 0, "18:00": 3}.
  besoins_par_creneau jsonb not null default '{}'::jsonb check (jsonb_typeof(besoins_par_creneau) = 'object'),
  ordre       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists poles_action_idx on public.poles (action_id, ordre);
alter table public.poles enable row level security;

drop policy if exists "Pôles : le bureau gère" on public.poles;
create policy "Pôles : le bureau gère" on public.poles for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- 3. Les inscriptions ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inscriptions_creneaux (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  pole_id     bigint not null references public.poles(id) on delete cascade,
  debut       time not null,
  -- Un adhérent de l'app, ou un nom écrit à la main par le bureau (quelqu'un sans compte).
  membre      uuid references public.profiles(id) on delete cascade,
  nom_libre   text check (nom_libre is null or length(trim(nom_libre)) between 1 and 80),
  ajoute_par  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  annulee_le  timestamptz,
  annulation_notifiee boolean not null default true,
  rappel_veille_le timestamptz,
  constraint inscriptions_creneaux_qui check ((membre is null) <> (nom_libre is null))
);
-- Remplacement (section 9) : depuis quand la personne cherche un remplaçant, qui a repris sa place,
-- et de quoi n'envoyer chaque notification qu'une fois (notify-taches).
alter table public.inscriptions_creneaux
  add column if not exists remplacant_recherche_le timestamptz,
  add column if not exists reprise_par uuid references public.profiles(id) on delete set null,
  add column if not exists reprise_notifiee boolean not null default true,
  add column if not exists sans_remplacant_signale_le timestamptz;
create index if not exists inscriptions_creneaux_pole_idx on public.inscriptions_creneaux (pole_id, debut);
create index if not exists inscriptions_creneaux_membre_idx on public.inscriptions_creneaux (membre);
-- Une seule inscription en cours par personne, pôle et heure.
create unique index if not exists inscriptions_creneaux_unique
  on public.inscriptions_creneaux (pole_id, debut, membre) where annulee_le is null and membre is not null;
alter table public.inscriptions_creneaux enable row level security;

drop policy if exists "Créneaux : le bureau gère" on public.inscriptions_creneaux;
create policy "Créneaux : le bureau gère" on public.inscriptions_creneaux for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- 4. Combien il faut de personnes sur un pôle à une heure donnée ───────────────────────────────────
create or replace function public.besoin_du_creneau(p_pole public.poles, p_debut time)
returns integer language sql immutable as $$
  select coalesce((p_pole.besoins_par_creneau ->> to_char(p_debut, 'HH24:MI'))::integer, p_pole.personnes);
$$;

-- 5. La garde : une heure qui existe, et jamais plus de monde que de places ────────────────────────
create or replace function public.inscriptions_creneaux_verifier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  le_pole public.poles;
  l_action public.actions;
  deja integer;
  depuis_le_debut integer; -- en minutes
begin
  -- Le verrou sur le pôle fait passer les inscriptions une par une.
  select * into le_pole from public.poles where id = new.pole_id for update;
  select * into l_action from public.actions where id = le_pole.action_id;
  -- En minutes plutôt qu'en heures : une heure + 2 h repasserait par minuit sans prévenir.
  depuis_le_debut := (extract(epoch from new.debut - l_action.creneau_debut) / 60)::integer;
  if l_action.creneau_debut is null
     or depuis_le_debut < 0
     or depuis_le_debut + l_action.creneau_duree_minutes
        > (extract(epoch from l_action.creneau_fin - l_action.creneau_debut) / 60)::integer
     or depuis_le_debut % l_action.creneau_duree_minutes <> 0 then
    raise exception 'Ce créneau n''existe pas.' using errcode = 'P0001';
  end if;
  select count(*) into deja from public.inscriptions_creneaux
   where pole_id = new.pole_id and debut = new.debut and annulee_le is null and id is distinct from new.id;
  if deja >= public.besoin_du_creneau(le_pole, new.debut) then
    raise exception 'Ce créneau est complet.' using errcode = 'P0001';
  end if;
  new.tenant_id := le_pole.tenant_id;
  return new;
end $$;
revoke all on function public.inscriptions_creneaux_verifier() from public, anon, authenticated;

drop trigger if exists inscriptions_creneaux_verifier on public.inscriptions_creneaux;
create trigger inscriptions_creneaux_verifier
  before insert or update of pole_id, debut, annulee_le on public.inscriptions_creneaux
  for each row when (new.annulee_le is null)
  execute function public.inscriptions_creneaux_verifier();

-- 6. Ce que voit un adhérent : les actions ouvertes à venir, places et créneaux à lui ──────────────
create or replace function public.plannings_ouverts()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'emoji', a.emoji, 'titre', a.titre, 'date', a.date_action,
    'debut', to_char(a.creneau_debut, 'HH24:MI'), 'fin', to_char(a.creneau_fin, 'HH24:MI'),
    'duree_minutes', a.creneau_duree_minutes,
    'poles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nom', p.nom, 'personnes', p.personnes, 'besoins_par_creneau', p.besoins_par_creneau,
        'pris', (select coalesce(jsonb_object_agg(t.heure, t.nombre), '{}'::jsonb) from (
                   select to_char(i.debut, 'HH24:MI') heure, count(*) nombre from public.inscriptions_creneaux i
                    where i.pole_id = p.id and i.annulee_le is null group by i.debut) t),
        'mes_inscriptions', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'debut', to_char(i.debut, 'HH24:MI'),
                                   'remplacant_recherche', i.remplacant_recherche_le is not null)), '[]'::jsonb)
                   from public.inscriptions_creneaux i
                  where i.pole_id = p.id and i.membre = auth.uid() and i.annulee_le is null),
        -- Les places dont la personne cherche un remplaçant, sans son nom (un adhérent ne voit pas
        -- qui est inscrit) ; les siennes n'y sont pas, elles sont dans mes_inscriptions.
        'a_reprendre', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'debut', to_char(i.debut, 'HH24:MI')) order by i.debut), '[]'::jsonb)
                   from public.inscriptions_creneaux i
                  where i.pole_id = p.id and i.annulee_le is null and i.remplacant_recherche_le is not null
                    and i.membre is distinct from auth.uid())
      ) order by p.ordre, p.id), '[]'::jsonb)
      from public.poles p where p.action_id = a.id)
  ) order by a.date_action, a.id), '[]'::jsonb)
  from public.actions a
  where a.tenant_id = public.current_tenant_id()
    and a.ouvert_aux_membres
    and a.creneau_debut is not null
    and a.date_action >= (now() at time zone 'Europe/Paris')::date;
$$;

-- 7. Prendre un créneau, ou le libérer (« Je ne peux plus venir ») ─────────────────────────────────
create or replace function public.prendre_creneau(p_pole bigint, p_debut time)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  nouvelle bigint;
begin
  if not exists (
    select 1 from public.poles p join public.actions a on a.id = p.action_id
     where p.id = p_pole and a.tenant_id = public.current_tenant_id() and a.ouvert_aux_membres
       and a.date_action >= (now() at time zone 'Europe/Paris')::date
  ) then
    raise exception 'Ce planning n''est pas ouvert.' using errcode = 'P0001';
  end if;
  -- On ne peut pas être à deux pôles à la même heure sur la même action.
  if exists (
    select 1 from public.inscriptions_creneaux i join public.poles p on p.id = i.pole_id
     where i.membre = auth.uid() and i.debut = p_debut and i.annulee_le is null
       and p.action_id = (select action_id from public.poles where id = p_pole)
  ) then
    raise exception 'Vous êtes déjà inscrit à cette heure-là.' using errcode = 'P0001';
  end if;
  insert into public.inscriptions_creneaux (pole_id, debut, membre) values (p_pole, p_debut, auth.uid())
  returning id into nouvelle;
  return nouvelle;
end $$;

create or replace function public.liberer_creneau(p_inscription bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.inscriptions_creneaux
     set annulee_le = now(), annulation_notifiee = false
   where id = p_inscription and membre = auth.uid() and annulee_le is null;
  if not found then
    raise exception 'Cette inscription n''existe plus.' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.plannings_ouverts() from public, anon;
revoke all on function public.prendre_creneau(bigint, time) from public, anon;
revoke all on function public.liberer_creneau(bigint) from public, anon;
grant execute on function public.plannings_ouverts() to authenticated;
grant execute on function public.prendre_creneau(bigint, time) to authenticated;
grant execute on function public.liberer_creneau(bigint) to authenticated;

-- 8. Ce que voit le bureau : les inscrits d'une action, avec leur nom ──────────────────────────────
-- Un membre du bureau qui n'est pas administrateur ne lit pas les fiches des adhérents : cette
-- fonction ne lui donne que le prénom et le nom des inscrits de ses propres actions.
-- Le type rendu a gagné une colonne (a_reprendre) : l'ancienne version doit disparaître d'abord.
drop function if exists public.inscrits_de_l_action(bigint);
create or replace function public.inscrits_de_l_action(p_action bigint)
returns table (id bigint, pole_id bigint, debut text, membre uuid, nom text, a_compte boolean, a_reprendre boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.pole_id, to_char(i.debut, 'HH24:MI'), i.membre,
         coalesce(i.nom_libre, nullif(trim(concat_ws(' ', pr.prenom, pr.nom)), ''), 'Adhérent'),
         i.membre is not null, i.remplacant_recherche_le is not null
    from public.inscriptions_creneaux i
    join public.poles p on p.id = i.pole_id
    left join public.profiles pr on pr.id = i.membre
   where p.action_id = p_action and i.annulee_le is null
     and p.tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
   order by i.debut, i.created_at;
$$;
revoke all on function public.inscrits_de_l_action(bigint) from public, anon;
grant execute on function public.inscrits_de_l_action(bigint) to authenticated;

-- 9. Chercher un remplaçant, puis reprendre la place ─────────────────────────────────────────────
-- « Je ne peux plus venir » → « Chercher un remplaçant » : la place reste au nom de la personne et
-- devient « à reprendre ». « Je la prends » : l'autre est inscrit et la première personne libérée,
-- en une seule fois (la place n'est jamais vide, ni prise deux fois). notify-taches prévient la
-- personne remplacée, et le référent la veille si personne n'a repris la place.
create or replace function public.chercher_remplacant(p_inscription bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.inscriptions_creneaux i set remplacant_recherche_le = now()
    from public.poles p join public.actions a on a.id = p.action_id
   where i.id = p_inscription and p.id = i.pole_id and i.membre = auth.uid() and i.annulee_le is null
     and i.remplacant_recherche_le is null and a.date_action >= (now() at time zone 'Europe/Paris')::date;
  if not found then
    raise exception 'Cette inscription n''existe plus.' using errcode = 'P0001';
  end if;
end $$;

-- « Finalement, je viens » : la place n'est plus à reprendre.
create or replace function public.annuler_recherche_de_remplacant(p_inscription bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.inscriptions_creneaux set remplacant_recherche_le = null, sans_remplacant_signale_le = null
   where id = p_inscription and membre = auth.uid() and annulee_le is null and remplacant_recherche_le is not null;
  if not found then
    raise exception 'Votre place a déjà été reprise.' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.reprendre_creneau(p_inscription bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  ancienne public.inscriptions_creneaux;
  l_action bigint;
  nouvelle bigint;
begin
  -- Le verrou sur la ligne : deux personnes qui touchent « Je la prends » en même temps ne
  -- peuvent pas toutes les deux reprendre la place.
  select i.* into ancienne from public.inscriptions_creneaux i
    join public.poles p on p.id = i.pole_id join public.actions a on a.id = p.action_id
   where i.id = p_inscription and i.annulee_le is null and i.remplacant_recherche_le is not null
     and a.tenant_id = public.current_tenant_id() and a.ouvert_aux_membres
     and a.date_action >= (now() at time zone 'Europe/Paris')::date
     for update of i;
  if ancienne.id is null then
    raise exception 'Cette place a déjà été reprise.' using errcode = 'P0001';
  end if;
  if ancienne.membre = auth.uid() then
    raise exception 'C''est votre propre place.' using errcode = 'P0001';
  end if;
  select action_id into l_action from public.poles where id = ancienne.pole_id;
  if exists (
    select 1 from public.inscriptions_creneaux i join public.poles p on p.id = i.pole_id
     where i.membre = auth.uid() and i.debut = ancienne.debut and i.annulee_le is null and p.action_id = l_action
  ) then
    raise exception 'Vous êtes déjà inscrit à cette heure-là.' using errcode = 'P0001';
  end if;
  -- D'abord libérer, puis inscrire : la garde des places compte les inscriptions en cours.
  -- annulation_notifiee reste vrai : le référent n'a rien à apprendre, la place est tenue.
  update public.inscriptions_creneaux
     set annulee_le = now(), annulation_notifiee = true, reprise_par = auth.uid(), reprise_notifiee = false
   where id = ancienne.id;
  insert into public.inscriptions_creneaux (pole_id, debut, membre) values (ancienne.pole_id, ancienne.debut, auth.uid())
  returning id into nouvelle;
  return nouvelle;
end $$;

revoke all on function public.chercher_remplacant(bigint) from public, anon;
revoke all on function public.annuler_recherche_de_remplacant(bigint) from public, anon;
revoke all on function public.reprendre_creneau(bigint) from public, anon;
grant execute on function public.chercher_remplacant(bigint) to authenticated;
grant execute on function public.annuler_recherche_de_remplacant(bigint) to authenticated;
grant execute on function public.reprendre_creneau(bigint) to authenticated;
