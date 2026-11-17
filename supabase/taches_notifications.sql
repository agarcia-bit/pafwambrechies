-- ── Pilotage : prévenir la personne à qui on confie une tâche, et lui rappeler l'échéance ──────
-- Une tâche confiée à quelqu'un d'autre que soi est notée « à annoncer » (confiee_notifiee = false) ;
-- la fonction notify-taches, lancée toutes les 5 minutes, regroupe ces annonces par personne et par
-- action (un modèle qui crée 7 tâches d'un coup donne une seule notification), puis envoie les
-- rappels de la veille et du jour de l'échéance, une seule fois chacun (rappel_veille_le,
-- rappel_jour_le, remis à zéro si l'échéance change). Peut être relancé sans risque.

alter table public.taches
  add column if not exists confiee_par uuid references public.profiles(id) on delete set null,
  add column if not exists confiee_notifiee boolean not null default true,
  add column if not exists rappel_veille_le timestamptz,
  add column if not exists rappel_jour_le timestamptz;

-- Qui confie la tâche, et s'il faut l'annoncer : jamais quand on se la confie soi-même, ni quand
-- elle est écrite par le serveur (auth.uid() vide), pour ne rien envoyer en double.
create or replace function public.taches_noter_qui_confie()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.responsable is not null
     and (tg_op = 'INSERT' or new.responsable is distinct from old.responsable) then
    new.confiee_par := auth.uid();
    new.confiee_notifiee := auth.uid() is null or new.responsable = auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.echeance is distinct from old.echeance then
    new.rappel_veille_le := null;
    new.rappel_jour_le := null;
  end if;
  return new;
end $$;

drop trigger if exists taches_noter_qui_confie on public.taches;
create trigger taches_noter_qui_confie
  before insert or update of responsable, echeance on public.taches
  for each row execute function public.taches_noter_qui_confie();

-- Toutes les 5 minutes : les annonces partent vite, les rappels attendent 9 h (heure de Paris).
-- La clé de service est déjà dans le Vault (secret 'service_role_key'), comme pour les autres rappels.
select cron.unschedule('taches-notifications')
  where exists (select 1 from cron.job where jobname = 'taches-notifications');

select cron.schedule(
  'taches-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ancwbfyjzaebxahtlqkm.supabase.co/functions/v1/notify-taches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
