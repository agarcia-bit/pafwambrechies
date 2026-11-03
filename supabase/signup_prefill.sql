-- À l'inscription, une fois le code d'accès validé : si l'adresse e-mail saisie est dans la
-- liste importée par le bureau (adherents_invites), l'app pré-remplit le prénom et le nom.
-- Le code est exigé (et compté comme un essai s'il est faux, comme resolve_signup_code) pour
-- qu'on ne puisse pas tester des adresses sans être membre.
create or replace function public.signup_prefill(p_code text, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_row record;
begin
  if public.signup_attempts_exceeded() then
    raise exception 'too_many_attempts';
  end if;
  select s.tenant_id into v_tenant
    from public.app_settings s
    where s.key = 'signup_code' and upper(s.value) = upper(trim(p_code))
    limit 1;
  if v_tenant is null then
    insert into public.signup_attempts (ip) values (public.client_ip());
    return null;
  end if;
  select i.prenom, i.nom into v_row
    from public.adherents_invites i
    where i.tenant_id = v_tenant
      and i.email = lower(btrim(p_email))
      and i.user_id is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object('prenom', v_row.prenom, 'nom', v_row.nom);
end;
$$;

revoke all on function public.signup_prefill(text, text) from public;
grant execute on function public.signup_prefill(text, text) to anon, authenticated;
