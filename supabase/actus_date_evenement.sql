-- Date of the event announced by an actu (not the publication date): shown as a calendar
-- tile at the top of the actu and on its card. Optional: most actus have none.
-- Only touches public.actus; the PWA ignores the new column.
alter table public.actus add column if not exists date_evenement date;
