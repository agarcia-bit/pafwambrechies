-- Moderation of what members publish (required by the App Store for user-generated content):
--
--   * signalements: a member reports a comment, an idea, an offer or a directory entry; the
--     bureau and the admins see the reports of their association and act on them;
--   * blocages: a member blocks another one: the app then hides what that member publishes
--     (the block list is private to the blocker);
--   * deleting an account removes the member's reports and blocks.
--
-- Only new tables (tenant_id) and functions: nothing used by the PAF web app or by Kadastria.

create table if not exists public.signalements (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('actus_commentaire', 'idee', 'idee_commentaire', 'offre', 'annuaire')),
  target_id   bigint not null,
  reason      text not null check (char_length(reason) between 1 and 200),
  traite      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (reporter_id, kind, target_id)
);
create index if not exists signalements_tenant_idx on public.signalements (tenant_id, traite, created_at desc);
alter table public.signalements enable row level security;

drop policy if exists "Members report" on public.signalements;
create policy "Members report"
  on public.signalements for insert to authenticated
  with check (reporter_id = auth.uid() and tenant_id = public.current_tenant_id());

drop policy if exists "Read own reports, bureau reads all" on public.signalements;
create policy "Read own reports, bureau reads all"
  on public.signalements for select to authenticated
  using (reporter_id = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()));

drop policy if exists "Bureau handles reports" on public.signalements;
create policy "Bureau handles reports"
  on public.signalements for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Bureau deletes reports" on public.signalements;
create policy "Bureau deletes reports"
  on public.signalements for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

create table if not exists public.blocages (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  nom        text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocages enable row level security;

drop policy if exists "Own blocks" on public.blocages;
create policy "Own blocks"
  on public.blocages for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and tenant_id = public.current_tenant_id() and blocked_id <> auth.uid());

-- ── What the bureau sees: each pending report with the reported content ─────
create or replace function public.signalements_a_traiter()
returns table (
  id bigint, kind text, target_id bigint, reason text, created_at timestamptz,
  reporter_nom text, contenu text, auteur_id uuid, auteur_nom text
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.kind, s.target_id, s.reason, s.created_at,
         nullif(btrim(coalesce(rp.prenom, '') || ' ' || coalesce(rp.nom, '')), ''),
         case s.kind
           when 'actus_commentaire' then (select c.texte from public.actus_commentaires c where c.id = s.target_id)
           when 'idee_commentaire'  then (select c.texte from public.idees_commentaires c where c.id = s.target_id)
           when 'idee'    then (select concat_ws(E'\n', i.titre, i.texte) from public.idees i where i.id = s.target_id)
           when 'offre'   then (select concat_ws(E'\n', o.titre, o.description) from public.offres o where o.id = s.target_id)
           when 'annuaire' then (select concat_ws(E'\n', a.nom_entreprise, a.description) from public.annuaire a where a.id = s.target_id)
         end,
         case s.kind
           when 'actus_commentaire' then (select c.user_id from public.actus_commentaires c where c.id = s.target_id)
           when 'idee_commentaire'  then (select c.user_id from public.idees_commentaires c where c.id = s.target_id)
           when 'idee'    then (select i.user_id from public.idees i where i.id = s.target_id)
           when 'offre'   then (select o.user_id from public.offres o where o.id = s.target_id)
           when 'annuaire' then (select a.user_id from public.annuaire a where a.id = s.target_id)
         end,
         case s.kind
           when 'actus_commentaire' then (select c.prenom from public.actus_commentaires c where c.id = s.target_id)
           when 'idee_commentaire'  then (select c.prenom from public.idees_commentaires c where c.id = s.target_id)
           when 'idee'    then (select i.prenom from public.idees i where i.id = s.target_id)
           when 'offre'   then (select o.commercant from public.offres o where o.id = s.target_id)
           when 'annuaire' then (select a.nom_entreprise from public.annuaire a where a.id = s.target_id)
         end
  from public.signalements s
  left join public.profiles rp on rp.id = s.reporter_id
  where public.is_bureau_or_admin()
    and s.tenant_id = public.current_tenant_id()
    and not s.traite
  order by s.created_at;
$$;
revoke all on function public.signalements_a_traiter() from public, anon;
grant execute on function public.signalements_a_traiter() to authenticated;

-- ── Deleting an account removes the member's reports and blocks ──────────────
create or replace function public.moderation_delete_with_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.signalements where reporter_id = old.id;
  delete from public.blocages where blocker_id = old.id or blocked_id = old.id;
  return old;
end;
$$;
revoke all on function public.moderation_delete_with_profile() from public, anon, authenticated;

drop trigger if exists moderation_delete_with_profile on public.profiles;
create trigger moderation_delete_with_profile
  after delete on public.profiles
  for each row execute function public.moderation_delete_with_profile();
