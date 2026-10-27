-- Who comes to an event ("Je participe").
--
--   * An event can ask its members to answer (evenements.participation, set by the bureau):
--     present, absent, or "indecis" (not sure yet).
--   * public.evenement_reponses: one row per member and event. A member reads and writes only
--     their own row, until the day of the event (Paris time); the bureau and admins read the
--     answers of their association, by name, through evenement_participants().
--   * Reminders: a week before the event, the members who have not answered get a push; two days
--     before, those who have not answered or are still undecided get a second one (edge function
--     notify-evenements, called every morning, see evenements_rappels_cron.sql). Each reminder
--     goes out once (evenement_rappels).
--
-- Affects only Allianceo's tables (tenant_id): nothing used by the PAF web app or by Kadastria.
-- Safe to run again.

alter table public.evenements add column if not exists participation boolean not null default false;

create table if not exists public.evenement_reponses (
  evenement_id bigint not null references public.evenements(id) on delete cascade,
  tenant_id    uuid   not null references public.tenants(id) on delete cascade,
  user_id      uuid   not null references auth.users(id) on delete cascade,
  reponse      text   not null check (reponse in ('present', 'absent', 'indecis')),
  updated_at   timestamptz not null default now(),
  primary key (evenement_id, user_id)
);
alter table public.evenement_reponses enable row level security;

drop policy if exists "Read evenement reponses" on public.evenement_reponses;
create policy "Read evenement reponses"
  on public.evenement_reponses for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (user_id = auth.uid() or public.is_bureau_or_admin())
  );

-- A member answers for themselves, for an event of their association that asks for it and is not over.
drop policy if exists "Members answer evenements" on public.evenement_reponses;
create policy "Members answer evenements"
  on public.evenement_reponses for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.evenements e
      where e.id = evenement_reponses.evenement_id
        and e.tenant_id = public.current_tenant_id()
        and e.participation
        and e.date >= (now() at time zone 'Europe/Paris')::date
    )
  );

drop policy if exists "Members change their answer" on public.evenement_reponses;
create policy "Members change their answer"
  on public.evenement_reponses for update to authenticated
  using (user_id = auth.uid() and tenant_id = public.current_tenant_id())
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.evenements e
      where e.id = evenement_reponses.evenement_id
        and e.tenant_id = public.current_tenant_id()
        and e.participation
        and e.date >= (now() at time zone 'Europe/Paris')::date
    )
  );
-- No delete policy: an answer can be changed, not withdrawn.

-- ── Bureau: every member of the association with their answer ────────────────
create or replace function public.evenement_participants(p_evenement bigint)
returns table (id uuid, prenom text, nom text, reponse text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.prenom, p.nom, r.reponse
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

-- ── Reminders already sent (only the edge function, service role, touches it) ─
create table if not exists public.evenement_rappels (
  evenement_id bigint not null references public.evenements(id) on delete cascade,
  jours        int    not null check (jours in (7, 2)),
  sent_at      timestamptz not null default now(),
  primary key (evenement_id, jours)
);
alter table public.evenement_rappels enable row level security;

-- ── Who could still be reminded: events within 7 days that ask for an answer ──
-- Called by the notify-evenements edge function (service_role only). Lists the members with no
-- answer or "indecis"; the function decides who gets which reminder. Associations that switched
-- the Agenda off are left out.
create or replace function public.evenements_a_relancer()
returns table (evenement_id bigint, tenant_id uuid, titre text, date date, user_id uuid, reponse text)
language sql
security definer
stable
set search_path = public
as $$
  with today as (select (now() at time zone 'Europe/Paris')::date as d)
  select e.id, e.tenant_id, e.titre, e.date, p.id, r.reponse
  from public.evenements e
  cross join today
  join public.profiles p on p.tenant_id = e.tenant_id
  left join public.evenement_reponses r on r.evenement_id = e.id and r.user_id = p.id
  where e.participation
    and e.date between today.d and today.d + 7
    and (r.reponse is null or r.reponse = 'indecis')
    and not exists (
      select 1 from public.app_settings s
      where s.tenant_id = e.tenant_id and s.key = 'module_agenda' and s.value = 'off'
    );
$$;
revoke all on function public.evenements_a_relancer() from public, anon, authenticated;
grant execute on function public.evenements_a_relancer() to service_role;
