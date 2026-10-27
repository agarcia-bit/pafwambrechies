-- Runs notify-evenements every morning (09:00 in summer, 08:00 in winter, Paris).
--
-- Needs the service_role key in the Vault (secret 'service_role_key'), already stored for the
-- poll and dues reminders: nothing to paste here.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('evenements-rappels')
  where exists (select 1 from cron.job where jobname = 'evenements-rappels');

select cron.schedule(
  'evenements-rappels',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://ancwbfyjzaebxahtlqkm.supabase.co/functions/v1/notify-evenements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
