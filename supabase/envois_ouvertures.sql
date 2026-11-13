-- ── Ouvertures des e-mails du bureau ─────────────────────────────────────────
-- Chaque e-mail envoyé par Resend reçoit une référence (resend_id), gardée à l'envoi par send-mail.
-- Quand le destinataire l'ouvre, Resend prévient la fonction resend-webhook, qui note ouvert_le.
-- Information approximative (Mail d'Apple ouvre les images tout seul), signalée dans la politique
-- de confidentialité. Les e-mails envoyés avant ce script n'ont pas de référence : pas de suivi.
-- Peut être relancé sans risque.

alter table public.envoi_destinataires add column if not exists resend_id text;
alter table public.envoi_destinataires add column if not exists ouvert_le timestamptz;
create index if not exists envoi_destinataires_resend_idx
  on public.envoi_destinataires (resend_id) where resend_id is not null;
