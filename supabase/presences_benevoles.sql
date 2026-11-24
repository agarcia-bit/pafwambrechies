-- ── Après l'action : pointage, remerciement et bilan des bénévoles ──────────────────────────────
-- Suite de supabase/creneaux.sql (à appliquer après lui).
--
--   1. Pointage : le jour J, le bureau coche qui est vraiment venu (« venu » / « absent ») ; sans
--      pointage, une inscription compte comme tenue. Le bureau écrit déjà dans la table.
--   2. Remerciement : le lendemain de l'action, notify-taches remercie chaque bénévole venu et note
--      qu'il l'a fait (une seule fois par action).
--   3. Bilan : qui a aidé combien de fois sur une période, pour l'assemblée générale ou pour
--      remercier les plus présents. Réservé au bureau.
-- Script rejouable sans risque.

-- 1. Le pointage ──────────────────────────────────────────────────────────────────────────────────
alter table public.inscriptions_creneaux
  add column if not exists presence text check (presence in ('venu', 'absent')),
  add column if not exists pointe_le timestamptz;

-- Les inscrits d'une action, avec leur pointage. Le type rendu gagne une colonne : l'ancienne
-- version doit disparaître d'abord.
drop function if exists public.inscrits_de_l_action(bigint);
create or replace function public.inscrits_de_l_action(p_action bigint)
returns table (id bigint, pole_id bigint, debut text, membre uuid, nom text, a_compte boolean, a_reprendre boolean, presence text)
language sql stable security definer set search_path = public as $$
  select i.id, i.pole_id, to_char(i.debut, 'HH24:MI'), i.membre,
         coalesce(i.nom_libre, nullif(trim(concat_ws(' ', pr.prenom, pr.nom)), ''), 'Adhérent'),
         i.membre is not null, i.remplacant_recherche_le is not null, i.presence
    from public.inscriptions_creneaux i
    join public.poles p on p.id = i.pole_id
    left join public.profiles pr on pr.id = i.membre
   where p.action_id = p_action and i.annulee_le is null
     and p.tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
   order by i.debut, i.created_at;
$$;
revoke all on function public.inscrits_de_l_action(bigint) from public, anon;
grant execute on function public.inscrits_de_l_action(bigint) to authenticated;

-- 2. Le remerciement du lendemain ─────────────────────────────────────────────────────────────────
alter table public.actions add column if not exists remerciement_envoye_le timestamptz;

-- 3. Le bilan des bénévoles ───────────────────────────────────────────────────────────────────────
-- Une ligne par personne : un adhérent de l'app, ou un nom écrit à la main (regroupé sans tenir
-- compte des majuscules). Seules les actions déjà passées comptent ; un absent pointé ne compte pas
-- comme créneau tenu.
create or replace function public.bilan_des_benevoles(p_debut date, p_fin date)
returns table (cle text, nom text, a_compte boolean, creneaux integer, actions integer, absences integer, derniere date)
language sql stable security definer set search_path = public as $$
  with lignes as (
    select coalesce(i.membre::text, 'libre:' || lower(trim(i.nom_libre))) as cle,
           coalesce(nullif(trim(concat_ws(' ', pr.prenom, pr.nom)), ''), i.nom_libre, 'Adhérent') as nom,
           i.membre is not null as a_compte, i.presence, a.id as action_id, a.date_action
      from public.inscriptions_creneaux i
      join public.poles p on p.id = i.pole_id
      join public.actions a on a.id = p.action_id
      left join public.profiles pr on pr.id = i.membre
     where i.annulee_le is null
       and a.tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
       and a.date_action between p_debut and least(p_fin, current_date)
  )
  select cle, min(nom), bool_or(a_compte),
         (count(*) filter (where presence is distinct from 'absent'))::integer,
         (count(distinct action_id) filter (where presence is distinct from 'absent'))::integer,
         (count(*) filter (where presence = 'absent'))::integer,
         max(date_action) filter (where presence is distinct from 'absent')
    from lignes
   group by cle
   order by 4 desc, 2;
$$;
revoke all on function public.bilan_des_benevoles(date, date) from public, anon;
grant execute on function public.bilan_des_benevoles(date, date) to authenticated;

-- 4. La fiche d'un bénévole ───────────────────────────────────────────────────────────────────────
-- Ses créneaux sur la période (même clé que le bilan : l'adhérent, ou le nom écrit à la main), pour
-- un mot de remerciement personnalisé. Réservé au bureau.
create or replace function public.creneaux_du_benevole(p_cle text, p_debut date, p_fin date)
returns table (action_id bigint, titre text, emoji text, date_action date, pole text, debut text, presence text)
language sql stable security definer set search_path = public as $$
  select a.id, a.titre, a.emoji, a.date_action, p.nom, to_char(i.debut, 'HH24:MI'), i.presence
    from public.inscriptions_creneaux i
    join public.poles p on p.id = i.pole_id
    join public.actions a on a.id = p.action_id
   where i.annulee_le is null
     and coalesce(i.membre::text, 'libre:' || lower(trim(i.nom_libre))) = p_cle
     and a.tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
     and a.date_action between p_debut and least(p_fin, current_date)
   order by a.date_action desc, i.debut;
$$;
revoke all on function public.creneaux_du_benevole(text, date, date) from public, anon;
grant execute on function public.creneaux_du_benevole(text, date, date) to authenticated;
