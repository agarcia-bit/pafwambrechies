-- ── Annuler la cotisation d'un adhérent pas encore inscrit ───────────────────
-- clear_cotisation n'efface que la cotisation d'un adhérent qui a un compte (table cotisations).
-- Pour un adhérent importé qui ne s'est pas encore inscrit, la date est gardée dans
-- adherents_invites.valide_jusqu : cette fonction l'efface, pour corriger une cotisation marquée
-- par erreur. Réservée au bureau et aux admins. Peut être relancé sans risque.

create or replace function public.effacer_cotisation_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_bureau_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.adherents_invites
     set valide_jusqu = null
   where tenant_id = public.current_tenant_id()
     and email = lower(btrim(p_email))
     and user_id is null;
end;
$$;
revoke all on function public.effacer_cotisation_invite(text) from public, anon;
grant execute on function public.effacer_cotisation_invite(text) to authenticated;
