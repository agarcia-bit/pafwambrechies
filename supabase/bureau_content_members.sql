-- Bureau members manage the content; only admins manage members and settings.
--
--   * content (actus, offres, agenda, annuaire, liens, polls, ideas moderation,
--     comment deletion, photos): admins AND bureau members;
--   * members, roles, association settings and the signup code: admins only.
--
-- Also closes a hole found while preparing this: the profiles UPDATE policy lets a
-- member change ANY column of their own row, role included, so any signed-in
-- member could make themselves admin through the API. A trigger now refuses a role
-- change unless it comes from set_member_role() (admin only) or from the SQL editor.
-- And the "Users insert own profile" policy is dropped (profiles are created by the
-- handle_new_user trigger; no client inserts them), which let a user without a
-- profile create one with any tenant and role.
--
-- Touches only public tables of the associations (tenant_id) and their storage
-- policies: nothing used by Kadastria / Immopilot.

-- ── 1. Role cannot be changed by the member themselves ───────────────────────
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_role_change', true), '') <> 'on' then
    raise exception 'role can only be changed by an administrator of the association'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

drop policy if exists "Users insert own profile" on public.profiles;

-- ── 2. Admin sets a member's role ────────────────────────────────────────────
create or replace function public.set_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if auth.uid() is null or v_tenant is null or not public.is_admin() then
    raise exception 'Reserved to association admins' using errcode = '42501';
  end if;
  if p_role not in ('adherent', 'bureau', 'admin') then
    raise exception 'Unknown role %', p_role;
  end if;
  if p_member = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  perform set_config('app.allow_role_change', 'on', true);
  update public.profiles set role = p_role
   where id = p_member and tenant_id = v_tenant;
  if not found then
    raise exception 'Member not found in this association';
  end if;
end;
$$;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- ── 3. Names of the association's members (poll results), no e-mail ──────────
create or replace function public.member_names()
returns table (id uuid, prenom text, nom text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.prenom, p.nom
  from public.profiles p
  where public.is_bureau_or_admin()
    and p.tenant_id = public.current_tenant_id();
$$;
revoke all on function public.member_names() from public, anon;
grant execute on function public.member_names() to authenticated;

-- ── 4. Content policies: admins and bureau ───────────────────────────────────
drop policy if exists "Admins insert tenant actus" on public.actus;
create policy "Bureau and admins insert tenant actus"
  on public.actus for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant actus" on public.actus;
create policy "Bureau and admins update tenant actus"
  on public.actus for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant actus" on public.actus;
create policy "Bureau and admins delete tenant actus"
  on public.actus for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins insert tenant annuaire" on public.annuaire;
create policy "Bureau and admins insert tenant annuaire"
  on public.annuaire for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant annuaire" on public.annuaire;
create policy "Bureau and admins update tenant annuaire"
  on public.annuaire for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant annuaire" on public.annuaire;
create policy "Bureau and admins delete tenant annuaire"
  on public.annuaire for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins insert tenant evenements" on public.evenements;
create policy "Bureau and admins insert tenant evenements"
  on public.evenements for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant evenements" on public.evenements;
create policy "Bureau and admins update tenant evenements"
  on public.evenements for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant evenements" on public.evenements;
create policy "Bureau and admins delete tenant evenements"
  on public.evenements for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins insert tenant liens" on public.liens;
create policy "Bureau and admins insert tenant liens"
  on public.liens for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant liens" on public.liens;
create policy "Bureau and admins update tenant liens"
  on public.liens for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant liens" on public.liens;
create policy "Bureau and admins delete tenant liens"
  on public.liens for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins insert tenant offres" on public.offres;
create policy "Bureau and admins insert tenant offres"
  on public.offres for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant offres" on public.offres;
create policy "Bureau and admins update tenant offres"
  on public.offres for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant offres" on public.offres;
create policy "Bureau and admins delete tenant offres"
  on public.offres for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant idees" on public.idees;
create policy "Bureau and admins update tenant idees"
  on public.idees for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant idees" on public.idees;
create policy "Bureau and admins delete tenant idees"
  on public.idees for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant actus comments" on public.actus_commentaires;
create policy "Bureau and admins delete tenant actus comments"
  on public.actus_commentaires for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins delete tenant idees comments" on public.idees_commentaires;
create policy "Bureau and admins delete tenant idees comments"
  on public.idees_commentaires for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

-- polls
drop policy if exists "Admins delete tenant sondages" on public.sondages;
create policy "Bureau and admins delete tenant sondages"
  on public.sondages for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Admins update tenant sondages" on public.sondages;
create policy "Bureau and admins update tenant sondages"
  on public.sondages for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin());

drop policy if exists "Members read tenant sondages" on public.sondages;
create policy "Members read tenant sondages"
  on public.sondages for select to authenticated
  using (tenant_id = public.current_tenant_id() and (actif or public.is_bureau_or_admin()));

drop policy if exists "Read own answers, admins read all" on public.sondage_reponses;
create policy "Read own answers, bureau and admins read all"
  on public.sondage_reponses for select to authenticated
  using (user_id = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_bureau_or_admin()));

-- photos
drop policy if exists "Admins upload actus photos" on storage.objects;
create policy "Bureau and admins upload actus photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'actus-photos' and public.is_bureau_or_admin());

drop policy if exists "Admins peuvent uploader des photos" on storage.objects;
create policy "Bureau and admins upload annuaire photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'annuaire-photos' and public.is_bureau_or_admin());

-- creer_sondage: same function, bureau members allowed too
create or replace function public.creer_sondage(
  p_question text,
  p_options text[],
  p_obligatoire boolean default false
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

  select coalesce(array_agg(btrim(o) order by ord), '{}')
    into v_options
    from unnest(p_options) with ordinality as t(o, ord)
    where btrim(o) <> '';
  if coalesce(array_length(v_options, 1), 0) not between 2 and 6 then
    raise exception 'A poll needs between 2 and 6 options';
  end if;

  insert into public.sondages (tenant_id, question, obligatoire)
  values (v_tenant, btrim(p_question), coalesce(p_obligatoire, false))
  returning id into v_id;

  for i in 1 .. array_length(v_options, 1) loop
    insert into public.sondage_options (sondage_id, tenant_id, libelle, position)
    values (v_id, v_tenant, v_options[i], i);
  end loop;
  return v_id;
end;
$$;
revoke all on function public.creer_sondage(text, text[], boolean) from public, anon;
grant execute on function public.creer_sondage(text, text[], boolean) to authenticated;
