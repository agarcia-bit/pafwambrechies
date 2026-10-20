-- Runs notify-poll-deadlines every morning (09:00 in summer, 08:00 in winter, Paris).
--
-- BEFORE running this file, store the project's service_role key once in the Vault
-- (Dashboard > Project Settings > API > service_role). Run this on its own, with the
-- real key instead of PASTE_KEY_HERE, and do not save it in any file:
--
--   select vault.create_secret('PASTE_KEY_HERE', 'service_role_key');
--
-- The key stays in the Vault: the job below reads it from there.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sondages-rappels')
  where exists (select 1 from cron.job where jobname = 'sondages-rappels');

select cron.schedule(
  'sondages-rappels',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://ancwbfyjzaebxahtlqkm.supabase.co/functions/v1/notify-poll-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
