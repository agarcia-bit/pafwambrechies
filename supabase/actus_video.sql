-- ── Vidéo YouTube d'une actu ─────────────────────────────────────────────────
-- Le bureau (ou un adhérent qui propose une actu) peut joindre une vidéo YouTube : l'application
-- montre sa vignette avec un bouton lecture et ouvre YouTube au toucher.
--
--   * actus.video_url : toujours écrit sous la même forme, https://www.youtube.com/watch?v=IDENTIFIANT ;
--   * la contrainte refuse tout autre lien : l'application n'ouvre donc jamais que YouTube,
--     même si quelqu'un écrit dans la table sans passer par les formulaires.
-- Peut être relancé sans risque.

alter table public.actus add column if not exists video_url text;
alter table public.actus drop constraint if exists actus_video_url_check;
alter table public.actus add constraint actus_video_url_check
  check (video_url is null or video_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$');
