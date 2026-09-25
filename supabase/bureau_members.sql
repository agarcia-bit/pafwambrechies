-- Members shown in the bureau screens (referents, task owners).
--
-- The profiles RLS lets only admins read other members, so a bureau member
-- who is not an admin saw no one but themselves when assigning actions.
-- Returns the association's bureau members and admins, plus anyone still
-- named on one of its actions or tasks (is_bureau = false: shown, but not
-- offered for new assignments). Empty for plain members.
create or replace function public.bureau_members()
returns table (id uuid, prenom text, nom text, is_bureau boolean)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.prenom, p.nom, p.role in ('bureau', 'admin')
  from public.profiles p
  where public.is_bureau_or_admin()
    and p.tenant_id = public.current_tenant_id()
    and (
      p.role in ('bureau', 'admin')
      or p.id in (select a.referent from public.actions a where a.tenant_id = p.tenant_id)
      or p.id in (select t.responsable from public.taches t where t.tenant_id = p.tenant_id)
    )
  order by p.prenom nulls last, p.nom nulls last;
$$;
revoke all on function public.bureau_members() from public, anon;
grant execute on function public.bureau_members() to authenticated;

-- Security advisor: pin the search_path of the referent inheritance trigger.
alter function public.propagate_action_referent() set search_path = public;
