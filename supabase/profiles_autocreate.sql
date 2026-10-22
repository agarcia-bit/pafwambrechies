-- ── Auto-create a profile row when a new auth user is created ───────────────
-- When an admin invites someone (or any user signs up), Supabase only creates
-- a row in auth.users; nothing populates public.profiles. This trigger fixes
-- that so the new user appears in the Table Editor immediately.
--
-- Also pulls prenom / nom from raw_user_meta_data when the invitation passes
-- them (sb.auth.admin.inviteUserByEmail(email, { data: { prenom, nom } })).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, prenom, nom)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'prenom', null),
    coalesce(new.raw_user_meta_data->>'nom', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill: create a profile for any existing auth user that is missing one
insert into public.profiles (id, email, prenom, nom)
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'prenom',
  u.raw_user_meta_data->>'nom'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
