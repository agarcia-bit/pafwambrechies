-- Members can propose offers. A proposal is NOT public until a bureau member or an admin
-- publishes it (statut 'publiee'); until then only its author and the bureau/admins see it.
--
--   * offres.user_id: who proposed it (null for offers created by the bureau/admins);
--   * offres.statut: 'publiee' (visible to all, all existing offers) or 'en_attente';
--   * a member's insert is always 'en_attente', and so is every edit by a member (the bureau
--     checks the change again); a member can delete their own proposals only;
--   * deleting an account deletes the member's offers.
--
-- Only touches public.offres (tenant_id). The PWA keeps working: it now only sees published
-- offers, because of the read policy.

alter table public.offres
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists statut text not null default 'publiee';

alter table public.offres drop constraint if exists offres_statut_check;
alter table public.offres add constraint offres_statut_check check (statut in ('publiee', 'en_attente'));

-- A plain member cannot publish, nor claim someone else's offer, nor change association.
create or replace function public.offres_guard_member()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_bureau_or_admin() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
    else
      new.user_id := old.user_id;
      new.tenant_id := old.tenant_id;
    end if;
    new.statut := 'en_attente';
  end if;
  return new;
end;
$$;

drop trigger if exists offres_guard_member on public.offres;
create trigger offres_guard_member
  before insert or update on public.offres
  for each row execute function public.offres_guard_member();

-- ── Access rules ─────────────────────────────────────────────────────────────
drop policy if exists "Users read tenant offres" on public.offres;
create policy "Users read tenant offres"
  on public.offres for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (statut = 'publiee' or user_id = auth.uid() or public.is_bureau_or_admin())
  );

drop policy if exists "Members insert own offres" on public.offres;
create policy "Members insert own offres"
  on public.offres for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

drop policy if exists "Members update own offres" on public.offres;
create policy "Members update own offres"
  on public.offres for update to authenticated
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

drop policy if exists "Members delete own offres" on public.offres;
create policy "Members delete own offres"
  on public.offres for delete to authenticated
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- ── Deleting an account deletes the member's offers ──────────────────────────
create or replace function public.offres_delete_with_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.offres where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists offres_delete_with_profile on public.profiles;
create trigger offres_delete_with_profile
  after delete on public.profiles
  for each row execute function public.offres_delete_with_profile();
