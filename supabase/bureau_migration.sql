-- ============================================================
-- Espace "Pilotage bureau" (multi-tenant, role bureau|admin only)
-- ============================================================
-- Two tables:
--   actions        - things the bureau plans / drives forward
--   taches         - subtasks belonging to a single action (cascade)
--
-- Both are tenant-scoped; access is gated on is_bureau_or_admin()
-- so plain adherents never see or touch them.

-- ── Helper: is the current user a bureau member OR admin of their tenant?
create or replace function public.is_bureau_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('bureau', 'admin')
  );
$$;

grant execute on function public.is_bureau_or_admin() to authenticated;

-- ── actions
create table if not exists public.actions (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id),
  emoji        text,
  titre        text not null,
  date_action  date not null,
  referent     uuid references public.profiles(id) on delete set null,
  statut       text not null default 'À faire'
               check (statut in ('À faire', 'En cours', 'Terminé', 'Bloqué')),
  budget       integer,
  created_at   timestamptz not null default now()
);

create index if not exists actions_tenant_date_idx
  on public.actions (tenant_id, date_action);
create index if not exists actions_tenant_statut_idx
  on public.actions (tenant_id, statut);
create index if not exists actions_referent_idx
  on public.actions (referent);

alter table public.actions enable row level security;

drop policy if exists "Bureau reads tenant actions"   on public.actions;
drop policy if exists "Bureau insert tenant actions"  on public.actions;
drop policy if exists "Bureau update tenant actions"  on public.actions;
drop policy if exists "Bureau delete tenant actions"  on public.actions;

create policy "Bureau reads tenant actions"
  on public.actions for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau insert tenant actions"
  on public.actions for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau update tenant actions"
  on public.actions for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau delete tenant actions"
  on public.actions for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- ── taches
create table if not exists public.taches (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id),
  action_id    bigint not null references public.actions(id) on delete cascade,
  libelle      text not null,
  responsable  uuid references public.profiles(id) on delete set null,
  echeance     date,
  statut       text not null default 'À faire'
               check (statut in ('À faire', 'En cours', 'Terminé')),
  priorite     text not null default 'Moyenne'
               check (priorite in ('Haute', 'Moyenne', 'Basse')),
  created_at   timestamptz not null default now()
);

create index if not exists taches_action_idx     on public.taches (action_id);
create index if not exists taches_tenant_idx     on public.taches (tenant_id);
create index if not exists taches_responsable_idx on public.taches (responsable);
create index if not exists taches_echeance_idx   on public.taches (echeance);

alter table public.taches enable row level security;

drop policy if exists "Bureau reads tenant taches"   on public.taches;
drop policy if exists "Bureau insert tenant taches"  on public.taches;
drop policy if exists "Bureau update tenant taches"  on public.taches;
drop policy if exists "Bureau delete tenant taches"  on public.taches;

create policy "Bureau reads tenant taches"
  on public.taches for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau insert tenant taches"
  on public.taches for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau update tenant taches"
  on public.taches for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create policy "Bureau delete tenant taches"
  on public.taches for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- ── When an action's referent changes, orphan taches (responsable IS NULL)
--    inherit the new referent. Already-assigned taches stay put.
create or replace function public.propagate_action_referent()
returns trigger
language plpgsql
as $$
begin
  if new.referent is distinct from old.referent then
    update public.taches
      set responsable = new.referent
      where action_id = new.id
        and responsable is null;
  end if;
  return new;
end;
$$;

drop trigger if exists actions_propagate_referent on public.actions;
create trigger actions_propagate_referent
  after update of referent on public.actions
  for each row execute function public.propagate_action_referent();
