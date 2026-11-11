-- ── Catégories des liens utiles ──────────────────────────────────────────────
-- Comme pour les documents : une catégorie facultative, écrite librement par le bureau
-- (« Mairie », « Partenaires »…). L'application regroupe les liens par catégorie.
-- Les liens existants restent sans catégorie. Peut être relancé sans risque.

alter table public.liens add column if not exists categorie text;
alter table public.liens drop constraint if exists liens_categorie_check;
alter table public.liens add constraint liens_categorie_check
  check (categorie is null or char_length(btrim(categorie)) between 1 and 60);
