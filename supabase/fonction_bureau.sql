-- ── Fonction au bureau (Président, Trésorier…) ───────────────────────────────
-- Une fonction facultative sur le profil, affichée à côté du nom dans l'espace bureau. Seuls le
-- bureau et les admins la changent (definir_fonction) ; un adhérent ne peut pas se l'attribuer,
-- même en modifiant son propre profil. Peut être relancé sans risque.

alter table public.profiles add column if not exists fonction text;
alter table public.profiles drop constraint if exists profiles_fonction_check;
alter table public.profiles add constraint profiles_fonction_check
  check (fonction is null or char_length(btrim(fonction)) between 1 and 40);

create or replace function public.profiles_garde_fonction()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fonction is distinct from old.fonction
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_fonction_change', true), '') <> 'on' then
    raise exception 'la fonction se change par le bureau' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_garde_fonction on public.profiles;
create trigger profiles_garde_fonction
  before update on public.profiles
  for each row execute function public.profiles_garde_fonction();

create or replace function public.definir_fonction(p_member uuid, p_fonction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('app.allow_fonction_change', 'on', true);
  update public.profiles
     set fonction = nullif(btrim(coalesce(p_fonction, '')), '')
   where id = p_member and tenant_id = public.current_tenant_id();
  perform set_config('app.allow_fonction_change', '', true);
end;
$$;
revoke all on function public.definir_fonction(uuid, text) from public, anon;
grant execute on function public.definir_fonction(uuid, text) to authenticated;

-- Les fonctions des membres de l'association, pour l'espace bureau (Pilotage, Adhérents).
create or replace function public.fonctions_du_bureau()
returns table (id uuid, fonction text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.fonction
  from public.profiles p
  where public.is_bureau_or_admin()
    and p.tenant_id = public.current_tenant_id()
    and p.fonction is not null;
$$;
revoke all on function public.fonctions_du_bureau() from public, anon;
grant execute on function public.fonctions_du_bureau() to authenticated;
