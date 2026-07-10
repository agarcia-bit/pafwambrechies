-- ============================================================
-- TENANT RULES - rend le solveur générique multi-tenant
-- ============================================================
-- Ajoute une colonne JSONB `rules` au tenant pour stocker
-- toutes les règles métier personnalisables (min staff, équipe
-- préparation cuisine, jour de prep, etc.)
--
-- Structure attendue (tous champs optionnels, défauts côté code) :
-- {
--   "minRestHours": 11,
--   "maxWorkingDays": 5,
--   "fulltimeThreshold": 35,
--   "minClosingWeekday": 4,
--   "minClosingWeekend": 6,
--   "weekendStartDay": 3,
--   "minKitchenMidi": 2,
--   "kitchenPrepDay": 1,
--   "kitchenPrepTeam": ["uuid1", "uuid2"],
--   "kitchenClosedSundayEvening": true,
--   "productivityLowerThreshold": 85,
--   "productivityUpperThreshold": 110
-- }

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.rules IS
  'Règles métier personnalisables (JSONB). Voir migration 002 pour la structure.';
