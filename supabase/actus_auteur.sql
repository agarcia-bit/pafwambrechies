-- Who published an actu: shown to the members as "Andy G." (first name and the
-- initial of the last name) next to the category.
--
--   * actus.auteur_id is filled by a trigger with the signed-in user (it cannot be
--     forged from the API); actus published before this stay without author, and
--     an actu inserted from the SQL editor / service role has none either.
--   * Members cannot read other members' profiles: actus_auteurs() hands out only
--     the name of the BUREAU MEMBERS AND ADMINS who published something.
--   * When an author deletes their account the actu stays, without author.
--
-- Only touches public.actus (tenant_id). The PWA keeps working: new nullable column,
-- and its inserts get the author automatically.

alter table public.actus
  add column if not exists auteur_id uuid references auth.users(id) on delete set null;

create or replace function public.actus_set_auteur()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists actus_set_auteur on public.actus;
create trigger actus_set_auteur
  before insert on public.actus
  for each row execute function public.actus_set_auteur();

create or replace function public.actus_auteurs()
returns table (id uuid, nom text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id,
         btrim(coalesce(p.prenom, '') || ' ' || case when coalesce(p.nom, '') <> '' then upper(left(p.nom, 1)) || '.' else '' end)
  from public.profiles p
  where p.tenant_id = public.current_tenant_id()
    and p.role in ('bureau', 'admin')
    and p.id in (select a.auteur_id from public.actus a where a.tenant_id = p.tenant_id);
$$;
revoke all on function public.actus_auteurs() from public, anon;
grant execute on function public.actus_auteurs() to authenticated;
