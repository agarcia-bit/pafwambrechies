-- Polls ("sondages") launched by the association's admins.
--
--   * Single choice among 2 to 6 options, one answer per member, no changing it.
--   * Answers are NOT anonymous: admins see who answered what (the app tells the
--     members). A member only ever reads their own answer; the totals and the
--     list of voters are for admins.
--   * A poll stays at the top of the member's feed until they answer it.
--   * Closing a poll (actif = false) removes it from the members' feed.
--   * Creating a poll sends a dedicated push notification (trigger below calls
--     the notify-new-actu edge function, which also handles this table).

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.sondages (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  question   text not null check (char_length(btrim(question)) between 3 and 300),
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sondages_tenant_idx on public.sondages (tenant_id, created_at desc);

create table if not exists public.sondage_options (
  id         bigint generated always as identity primary key,
  sondage_id bigint not null references public.sondages(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  libelle    text not null check (char_length(btrim(libelle)) between 1 and 120),
  position   int not null default 0
);
create index if not exists sondage_options_sondage_idx on public.sondage_options (sondage_id, position);

create table if not exists public.sondage_reponses (
  id         bigint generated always as identity primary key,
  sondage_id bigint not null references public.sondages(id) on delete cascade,
  option_id  bigint not null references public.sondage_options(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sondage_id, user_id)
);
create index if not exists sondage_reponses_option_idx on public.sondage_reponses (option_id);

alter table public.sondages         enable row level security;
alter table public.sondage_options  enable row level security;
alter table public.sondage_reponses enable row level security;

-- ── Access rules ────────────────────────────────────────────────────────────
drop policy if exists "Members read tenant sondages" on public.sondages;
create policy "Members read tenant sondages"
  on public.sondages for select to authenticated
  using (tenant_id = public.current_tenant_id() and (actif or public.is_admin()));

drop policy if exists "Admins update tenant sondages" on public.sondages;
create policy "Admins update tenant sondages"
  on public.sondages for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

drop policy if exists "Admins delete tenant sondages" on public.sondages;
create policy "Admins delete tenant sondages"
  on public.sondages for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

-- Options are written only by creer_sondage() below (and removed with their poll).
drop policy if exists "Members read tenant sondage options" on public.sondage_options;
create policy "Members read tenant sondage options"
  on public.sondage_options for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Read own answers, admins read all" on public.sondage_reponses;
create policy "Read own answers, admins read all"
  on public.sondage_reponses for select to authenticated
  using (user_id = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_admin()));

-- Answer once, to an open poll of the member's association, with one of its options.
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
    )
  );

-- ── Creating a poll (poll + options in one go, admins only) ─────────────────
create or replace function public.creer_sondage(p_question text, p_options text[])
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
  if auth.uid() is null or v_tenant is null or not public.is_admin() then
    raise exception 'Reserved to association admins';
  end if;

  select coalesce(array_agg(btrim(o) order by ord), '{}')
    into v_options
    from unnest(p_options) with ordinality as t(o, ord)
    where btrim(o) <> '';
  if coalesce(array_length(v_options, 1), 0) not between 2 and 6 then
    raise exception 'A poll needs between 2 and 6 options';
  end if;

  insert into public.sondages (tenant_id, question)
  values (v_tenant, btrim(p_question))
  returning id into v_id;

  for i in 1 .. array_length(v_options, 1) loop
    insert into public.sondage_options (sondage_id, tenant_id, libelle, position)
    values (v_id, v_tenant, v_options[i], i);
  end loop;
  return v_id;
end;
$$;
revoke all on function public.creer_sondage(text, text[]) from public, anon;
grant execute on function public.creer_sondage(text, text[]) to authenticated;

-- ── Account deletion also removes the member's answers ──────────────────────
-- (the login itself may be kept when it is shared with another app, so the
-- answers cannot rely on the cascade from auth.users)
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used_elsewhere boolean := false;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and n.nspname not in ('public', 'auth', 'storage')
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_used_elsewhere using v_uid;
    exit when v_used_elsewhere;
  end loop;

  delete from public.device_tokens      where user_id = v_uid;
  delete from public.push_subscriptions where user_id = v_uid;
  delete from public.actus_likes        where user_id = v_uid;
  delete from public.actus_commentaires where user_id = v_uid;
  delete from public.idees_likes        where user_id = v_uid;
  delete from public.idees_commentaires where user_id = v_uid;
  delete from public.idees              where user_id = v_uid;
  delete from public.sondage_reponses   where user_id = v_uid;
  delete from public.profiles           where id = v_uid;

  if not v_used_elsewhere then
    delete from auth.users where id = v_uid;
  end if;

  return jsonb_build_object('login_deleted', not v_used_elsewhere);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Notification: a new poll calls the notify-new-actu edge function ────────
-- Same webhook as on_new_actu (copied from it, so the service key never appears
-- in this file); the function recognises the table in the payload.
do $$
declare
  v_def text;
begin
  select pg_get_triggerdef(t.oid) into v_def
    from pg_trigger t
    where t.tgname = 'on_new_actu' and t.tgrelid = 'public.actus'::regclass;
  if v_def is null then
    raise exception 'on_new_actu not found: create the webhook for public.sondages by hand';
  end if;
  drop trigger if exists on_new_sondage on public.sondages;
  execute replace(replace(v_def, 'on_new_actu', 'on_new_sondage'), 'ON public.actus', 'ON public.sondages');
end;
$$;
