-- Each member can keep their own directory entry ("ma fiche") up to date: photo, contact
-- details, description. Bureau members and admins still manage every entry.
--
--   * annuaire.user_id links an entry to the member it belongs to (one entry per member).
--   * A member can create their entry, and edit it; never delete it, never edit another's,
--     never move it to another association or give it to someone else.
--   * Existing entries are linked by e-mail: the entry whose e-mail is the member's login
--     e-mail becomes theirs (backfill below, and claim_ma_fiche() for later signups).
--   * Photos: a member may only upload in their own folder of the annuaire-photos bucket.
--   * When a member deletes their account, their entry is deleted with it.
--
-- Only touches public.annuaire (tenant_id) and its photo bucket: nothing used by the PAF
-- web app (which only reads this table) or by Kadastria.

alter table public.annuaire
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists annuaire_one_per_member
  on public.annuaire (tenant_id, user_id) where user_id is not null;

-- ── Link the existing entries by e-mail (only when the match is unambiguous) ──
update public.annuaire a
   set user_id = p.id
  from public.profiles p
 where a.user_id is null
   and a.email is not null
   and p.tenant_id = a.tenant_id
   and lower(btrim(p.email)) = lower(btrim(a.email))
   and (select count(*) from public.annuaire b
         where b.tenant_id = a.tenant_id and lower(btrim(b.email)) = lower(btrim(a.email))) = 1
   and not exists (select 1 from public.annuaire c where c.tenant_id = a.tenant_id and c.user_id = p.id);

-- ── Access rules (added to the bureau/admin ones: policies combine with OR) ──
drop policy if exists "Members insert own annuaire" on public.annuaire;
create policy "Members insert own annuaire"
  on public.annuaire for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

drop policy if exists "Members update own annuaire" on public.annuaire;
create policy "Members update own annuaire"
  on public.annuaire for update to authenticated
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- A plain member cannot change who owns an entry nor which association it belongs to.
create or replace function public.annuaire_guard_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_bureau_or_admin() then
    new.user_id := old.user_id;
    new.tenant_id := old.tenant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists annuaire_guard_owner on public.annuaire;
create trigger annuaire_guard_owner
  before update on public.annuaire
  for each row execute function public.annuaire_guard_owner();

-- ── A member who signed up after the entry was created claims it by e-mail ──
create or replace function public.claim_ma_fiche()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_tenant uuid := public.current_tenant_id();
  v_email  text;
  v_id     bigint;
begin
  if v_uid is null or v_tenant is null then
    return null;
  end if;
  select id into v_id from public.annuaire where tenant_id = v_tenant and user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;
  select lower(btrim(email)) into v_email from public.profiles where id = v_uid;
  if v_email is null or v_email = '' then
    return null;
  end if;
  -- Only an entry that nobody owns yet and whose e-mail is unique in the association.
  select a.id into v_id
    from public.annuaire a
   where a.tenant_id = v_tenant and a.user_id is null and lower(btrim(a.email)) = v_email
     and (select count(*) from public.annuaire b
           where b.tenant_id = v_tenant and lower(btrim(b.email)) = v_email) = 1;
  if v_id is null then
    return null;
  end if;
  update public.annuaire set user_id = v_uid where id = v_id and user_id is null;
  return v_id;
end;
$$;
revoke all on function public.claim_ma_fiche() from public, anon;
grant execute on function public.claim_ma_fiche() to authenticated;

-- ── Photos: a member uploads into their own folder only ──────────────────────
drop policy if exists "Members upload own annuaire photos" on storage.objects;
create policy "Members upload own annuaire photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'annuaire-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Deleting an account deletes the member's entry ───────────────────────────
create or replace function public.annuaire_delete_with_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.annuaire where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists annuaire_delete_with_profile on public.profiles;
create trigger annuaire_delete_with_profile
  after delete on public.profiles
  for each row execute function public.annuaire_delete_with_profile();
