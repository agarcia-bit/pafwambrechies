-- ============================================================
-- Discussion du bureau : un fil général et un fil par action du Pilotage
-- ============================================================
-- Réservée au bureau et aux administrateurs (comme actions et taches).
--   bureau_messages  - les messages ; action_id null = fil général
--   bureau_lectures  - jusqu'où chacun a lu chaque fil (badges « non lus »)
--   bureau_sourdine  - présence = pas de notification pour les messages du bureau
-- Les messages arrivent en direct (Realtime) et notifient le reste du bureau
-- (webhook on_new_bureau_message -> fonction notify-bureau-message).

-- ── Messages
create table if not exists public.bureau_messages (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  action_id   bigint references public.actions(id) on delete cascade,
  auteur      uuid default auth.uid() references public.profiles(id) on delete set null,
  auteur_nom  text,
  texte       text not null check (char_length(btrim(texte)) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create index if not exists bureau_messages_fil_idx
  on public.bureau_messages (tenant_id, action_id, created_at);

-- Le nom de l'auteur est figé à l'envoi : il reste lisible s'il quitte le bureau.
create or replace function public.bureau_message_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.auteur := auth.uid();
  select coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email, 'Membre du bureau')
    into new.auteur_nom
    from public.profiles p where p.id = auth.uid();
  new.texte := btrim(new.texte);
  return new;
end;
$$;

drop trigger if exists bureau_messages_auteur on public.bureau_messages;
create trigger bureau_messages_auteur
  before insert on public.bureau_messages
  for each row execute function public.bureau_message_auteur();

alter table public.bureau_messages enable row level security;

drop policy if exists "Bureau reads messages"   on public.bureau_messages;
drop policy if exists "Bureau writes messages"  on public.bureau_messages;
drop policy if exists "Author or admin deletes" on public.bureau_messages;

create policy "Bureau reads messages"
  on public.bureau_messages for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- Le fil d'une action doit appartenir à la même association.
create policy "Bureau writes messages"
  on public.bureau_messages for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()
    and (action_id is null or exists (select 1 from public.actions a where a.id = action_id and a.tenant_id = bureau_messages.tenant_id))
  );

create policy "Author or admin deletes"
  on public.bureau_messages for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin() and (auteur = auth.uid() or public.is_admin()));

-- En direct sur le site et dans l'app (les règles ci-dessus s'appliquent aussi).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bureau_messages') then
    alter publication supabase_realtime add table public.bureau_messages;
  end if;
end;
$$;

-- ── Lectures : fil 0 = fil général, sinon l'id de l'action
create table if not exists public.bureau_lectures (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fil       bigint not null default 0,
  lu_jusqu  timestamptz not null default now(),
  primary key (user_id, tenant_id, fil)
);

alter table public.bureau_lectures enable row level security;
drop policy if exists "Own reads" on public.bureau_lectures;
create policy "Own reads" on public.bureau_lectures for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.bureau_marquer_lu(p_fil bigint default 0)
returns void
language sql
set search_path = public
as $$
  insert into public.bureau_lectures (user_id, tenant_id, fil, lu_jusqu)
  values (auth.uid(), public.current_tenant_id(), coalesce(p_fil, 0), now())
  on conflict (user_id, tenant_id, fil) do update set lu_jusqu = excluded.lu_jusqu;
$$;

-- Messages des autres pas encore lus, par fil. Un fil jamais ouvert ne compte que
-- les messages des 30 derniers jours (pas de vieux compteurs pour un nouveau membre).
create or replace function public.bureau_non_lus()
returns table (fil bigint, n integer)
language sql
stable
set search_path = public
as $$
  select coalesce(m.action_id, 0) as fil, count(*)::int as n
  from public.bureau_messages m
  left join public.bureau_lectures l
    on l.user_id = auth.uid() and l.tenant_id = m.tenant_id and l.fil = coalesce(m.action_id, 0)
  where m.tenant_id = public.current_tenant_id()
    and m.auteur is distinct from auth.uid()
    and m.created_at > coalesce(l.lu_jusqu, now() - interval '30 days')
  group by 1;
$$;

grant execute on function public.bureau_marquer_lu(bigint) to authenticated;
grant execute on function public.bureau_non_lus() to authenticated;

-- ── Sourdine : pas de notification pour les messages du bureau
create table if not exists public.bureau_sourdine (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (user_id, tenant_id)
);

alter table public.bureau_sourdine enable row level security;
drop policy if exists "Own mute" on public.bureau_sourdine;
create policy "Own mute" on public.bureau_sourdine for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Notification : même webhook que on_new_actu (copié, la clé de service n'apparaît
-- jamais dans ce fichier), vers la fonction notify-bureau-message (à déployer d'abord).
do $$
declare
  v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def
    from pg_trigger t
    where t.tgname = 'on_new_actu' and t.tgrelid = 'public.actus'::regclass;
  if v_def is null then
    raise exception 'on_new_actu not found: create the webhook for public.bureau_messages by hand';
  end if;
  drop trigger if exists on_new_bureau_message on public.bureau_messages;
  execute replace(replace(replace(v_def, 'on_new_actu', 'on_new_bureau_message'), 'ON public.actus', 'ON public.bureau_messages'), 'notify-new-actu', 'notify-bureau-message');
end;
$$;
