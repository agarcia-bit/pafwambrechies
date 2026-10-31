-- E-mails sent by the bureau (envois.sql): how long the trace of each recipient is kept.
--
--   * deleting one's account (delete_my_account) now also removes the member's rows in
--     envoi_destinataires (by user id and by e-mail address: imported members were written to
--     the history before they had an account);
--   * a daily job removes the history older than 12 months (envois and, by cascade, their
--     recipients), as the privacy policy says.
-- Safe to run again.

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_used_elsewhere boolean := false;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and n.nspname not in ('public', 'auth', 'storage')
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_used_elsewhere using v_uid;
    exit when v_used_elsewhere;
  end loop;

  delete from public.device_tokens       where user_id = v_uid;
  delete from public.push_subscriptions  where user_id = v_uid;
  delete from public.actus_likes         where user_id = v_uid;
  delete from public.actus_commentaires  where user_id = v_uid;
  delete from public.idees_likes         where user_id = v_uid;
  delete from public.idees_commentaires  where user_id = v_uid;
  delete from public.idees               where user_id = v_uid;
  delete from public.envoi_destinataires where user_id = v_uid or lower(email) = v_email;
  delete from public.profiles            where id = v_uid;  -- actions/taches referents are set to null

  if not v_used_elsewhere then
    delete from auth.users where id = v_uid;
  end if;

  return jsonb_build_object('login_deleted', not v_used_elsewhere);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── 12 months of history at most ─────────────────────────────────────────────
select cron.unschedule('envois-retention') where exists (select 1 from cron.job where jobname = 'envois-retention');
select cron.schedule(
  'envois-retention',
  '30 3 * * *',
  $$ delete from public.envois where created_at < now() - interval '12 months' $$
);
