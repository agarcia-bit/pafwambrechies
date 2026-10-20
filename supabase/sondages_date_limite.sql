-- Poll deadline ("date limite") and its reminders.
--
--   * A poll can have a deadline (a calendar day, Paris time). Members can answer
--     until the end of that day; after it the poll leaves their feed.
--   * Members who have not answered get a push notification 7 days before, 3 days
--     before, and the day before the deadline (the reminders that fall before the
--     poll was published are skipped). They are sent by the notify-poll-deadlines
--     edge function, called every morning by pg_cron (see sondages_rappels_cron.sql).
--
-- Affects only Allianceo's poll tables (tenant_id): nothing used by the PAF web app
-- or by Kadastria.

alter table public.sondages add column if not exists date_limite date;

-- Reminders already sent (so that each one goes out once). Only the edge function
-- (service role) touches it: RLS enabled, no policy.
create table if not exists public.sondage_rappels (
  sondage_id bigint not null references public.sondages(id) on delete cascade,
  jours      int    not null check (jours in (7, 3, 1)),
  sent_at    timestamptz not null default now(),
  primary key (sondage_id, jours)
);
alter table public.sondage_rappels enable row level security;

-- After the deadline, answering is refused.
drop policy if exists "Members answer open tenant sondages" on public.sondage_reponses;
create policy "Members answer open tenant sondages"
  on public.sondage_reponses for insert to authenticated
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.sondage_options o
      join public.sondages s on s.id = o.sondage_id
      where o.id = sondage_reponses.option_id
        and o.sondage_id = sondage_reponses.sondage_id
        and s.tenant_id = public.current_tenant_id()
        and s.actif
        and (s.date_limite is null or s.date_limite >= (now() at time zone 'Europe/Paris')::date)
    )
  );

-- creer_sondage with the deadline (the old signature is removed: no ambiguity).
drop function if exists public.creer_sondage(text, text[], boolean);

create or replace function public.creer_sondage(
  p_question text,
  p_options text[],
  p_obligatoire boolean default false,
  p_date_limite date default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid := public.current_tenant_id();
  v_options text[];
  v_id      bigint;
  i         int;
begin
  if auth.uid() is null or v_tenant is null or not public.is_bureau_or_admin() then
    raise exception 'Reserved to association admins and bureau members';
  end if;
  if p_date_limite is not null and p_date_limite < (now() at time zone 'Europe/Paris')::date then
    raise exception 'The deadline cannot be in the past';
  end if;

  select coalesce(array_agg(btrim(o) order by ord), '{}')
    into v_options
    from unnest(p_options) with ordinality as t(o, ord)
    where btrim(o) <> '';
  if coalesce(array_length(v_options, 1), 0) not between 2 and 6 then
    raise exception 'A poll needs between 2 and 6 options';
  end if;

  insert into public.sondages (tenant_id, question, obligatoire, date_limite)
  values (v_tenant, btrim(p_question), coalesce(p_obligatoire, false), p_date_limite)
  returning id into v_id;

  for i in 1 .. array_length(v_options, 1) loop
    insert into public.sondage_options (sondage_id, tenant_id, libelle, position)
    values (v_id, v_tenant, v_options[i], i);
  end loop;
  return v_id;
end;
$$;
revoke all on function public.creer_sondage(text, text[], boolean, date) from public, anon;
grant execute on function public.creer_sondage(text, text[], boolean, date) to authenticated;
