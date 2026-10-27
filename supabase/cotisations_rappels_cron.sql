-- Runs notify-cotisations every Monday (08:00 in winter, 09:00 in summer, Paris): one push a week
-- to the members whose dues must be renewed while their association's campaign is open.
--
-- Needs the Vault secret 'service_role_key' already created for the poll reminders
-- (see sondages_rappels_cron.sql). Safe to run again.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('cotisations-rappels')
  where exists (select 1 from cron.job where jobname = 'cotisations-rappels');

select cron.schedule(
  'cotisations-rappels',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://ancwbfyjzaebxahtlqkm.supabase.co/functions/v1/notify-cotisations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
