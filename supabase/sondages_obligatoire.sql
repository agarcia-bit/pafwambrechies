-- A poll can be required: members cannot postpone it, and the app stays covered
-- by it until it is answered. Without it, a member can postpone once and gets a
-- reminder 3 days later (that reminder is scheduled on the phone, see the app).
--
-- Affects only public.sondages and public.creer_sondage (Allianceo): nothing used
-- by the PAF web app or by Kadastria.

alter table public.sondages add column if not exists obligatoire boolean not null default false;

-- Same function with one more parameter: the old signature is removed so that a
-- call with two arguments cannot be ambiguous.
drop function if exists public.creer_sondage(text, text[]);

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
  if auth.uid() is null or v_tenant is null or not public.is_admin() then
    raise exception 'Reserved to association admins';
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
