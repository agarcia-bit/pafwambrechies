-- ── Événements sur plusieurs jours ───────────────────────────────────────────
-- Un événement peut durer plusieurs jours (date_fin, facultative). Pour un tel événement, un
-- adhérent présent peut préciser :
--   * les jours où il vient (jours) : vide = toute la durée ;
--   * un détail écrit à la main (precision), par exemple « j'arrive samedi vers 15 h ».
-- Les réponses restent ouvertes jusqu'au dernier jour, et l'événement reste dans l'agenda
-- jusqu'à sa fin. Les rappels partent toujours avant le premier jour.
-- Peut être relancé sans risque.

alter table public.evenements add column if not exists date_fin date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evenements_date_fin_apres_debut') then
    alter table public.evenements
      add constraint evenements_date_fin_apres_debut check (date_fin is null or date_fin > date);
  end if;
end $$;

alter table public.evenement_reponses add column if not exists jours date[];
alter table public.evenement_reponses add column if not exists precision text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evenement_reponses_precision_courte') then
    alter table public.evenement_reponses
      add constraint evenement_reponses_precision_courte check (precision is null or char_length(precision) <= 300);
  end if;
end $$;

-- Une réponse est acceptée jusqu'au dernier jour, et seulement avec des jours de l'événement.
create or replace function public.reponse_evenement_valide(p_evenement bigint, p_jours date[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.evenements e
    where e.id = p_evenement
      and e.tenant_id = public.current_tenant_id()
      and e.participation
      and coalesce(e.date_fin, e.date) >= (now() at time zone 'Europe/Paris')::date
      and (p_jours is null
           or not exists (select 1 from unnest(p_jours) j where j < e.date or j > coalesce(e.date_fin, e.date)))
  );
$$;
revoke all on function public.reponse_evenement_valide(bigint, date[]) from public, anon;
grant execute on function public.reponse_evenement_valide(bigint, date[]) to authenticated;

drop policy if exists "Members answer evenements" on public.evenement_reponses;
create policy "Members answer evenements"
  on public.evenement_reponses for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
    and public.reponse_evenement_valide(evenement_id, jours)
  );

drop policy if exists "Members change their answer" on public.evenement_reponses;
create policy "Members change their answer"
  on public.evenement_reponses for update to authenticated
  using (user_id = auth.uid() and tenant_id = public.current_tenant_id())
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
    and public.reponse_evenement_valide(evenement_id, jours)
  );

-- Le bureau voit aussi les jours choisis et la précision : la forme du résultat change.
drop function if exists public.evenement_participants(bigint);
create function public.evenement_participants(p_evenement bigint)
returns table (id uuid, prenom text, nom text, reponse text, jours date[], precision text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.prenom, p.nom, r.reponse, r.jours, r.precision
  from public.profiles p
  left join public.evenement_reponses r on r.user_id = p.id and r.evenement_id = p_evenement
  where public.is_bureau_or_admin()
    and p.tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.evenements e where e.id = p_evenement and e.tenant_id = p.tenant_id
    )
  order by p.prenom nulls last, p.nom nulls last;
$$;
revoke all on function public.evenement_participants(bigint) from public, anon;
grant execute on function public.evenement_participants(bigint) to authenticated;
