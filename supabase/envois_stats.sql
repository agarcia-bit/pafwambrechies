-- E-mails sent through send-mail, counted per association (see envois.sql).
--
--   envois_stats(): today / this month / last month / total per association.
--     * a platform admin sees EVERY association (to follow the shared Resend quota and,
--       later, to bill by usage);
--     * the bureau and admins of an association see their own line only;
--     * anybody else gets nothing.
-- Days and months are counted in Paris time, like Resend's dashboard roughly does. Safe to run again.

create or replace function public.envois_stats()
returns table (tenant_id uuid, association text, aujourd_hui bigint, ce_mois bigint, mois_precedent bigint, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  with bounds as (
    select (now() at time zone 'Europe/Paris')::date as today,
           date_trunc('month', now() at time zone 'Europe/Paris')::date as month_start,
           (date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month')::date as prev_start
  ),
  rows as (
    select e.tenant_id, (e.created_at at time zone 'Europe/Paris')::date as day, e.nb
    from public.envois e
  )
  select t.id, t.name,
         coalesce(sum(r.nb) filter (where r.day = b.today), 0),
         coalesce(sum(r.nb) filter (where r.day >= b.month_start), 0),
         coalesce(sum(r.nb) filter (where r.day >= b.prev_start and r.day < b.month_start), 0),
         coalesce(sum(r.nb), 0)
  from public.tenants t
  cross join bounds b
  left join rows r on r.tenant_id = t.id
  where public.is_platform_admin()
     or (t.id = public.current_tenant_id() and public.is_bureau_or_admin())
  group by t.id, t.name
  order by 4 desc, t.name;
$$;
revoke all on function public.envois_stats() from public, anon;
grant execute on function public.envois_stats() to authenticated;
