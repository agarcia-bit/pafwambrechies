-- ============================================================
-- RATTRAPAGE : aligne la chaîne de migrations sur la production
-- ============================================================
-- Plusieurs évolutions ont été appliquées directement en production sans
-- migration correspondante. Résultat : `supabase db reset` produisait une base
-- incompatible avec l'application (colonnes manquantes, contrainte d'unicité
-- absente), et une restauration après incident était impossible.
--
-- Cette migration rattrape l'écart. Elle est ENTIÈREMENT IDEMPOTENTE :
-- sans effet sur la production (tout y existe déjà), elle amène une base
-- vierge au même état.
--
-- Écarts couverts :
--   1. colonnes `department` (employees, shift_templates, plannings) + CHECK
--   2. employees.contract_end_date + fonction deactivate_expired_contracts()
--   3. unavailabilities : available_from / available_until / hours_reduction
--   4. plannings.updated_at + set_updated_at() + trigger
--   5. contrainte UNIQUE (tenant_id, week_start_date, department)
--      — indispensable au ON CONFLICT de save_planning_with_entries (mig. 008)
--   6. planning_entries.role_id nullable + ON DELETE SET NULL
--   7. policies super_admin (profiles, tenants) et profile_isolation corrigée

-- ------------------------------------------------------------
-- 1. Département salle / cuisine
-- ------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'salle';
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_department_check
  CHECK (department IN ('salle', 'cuisine'));

ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'salle';
ALTER TABLE public.shift_templates DROP CONSTRAINT IF EXISTS shift_templates_department_check;
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_department_check
  CHECK (department IN ('salle', 'cuisine'));

ALTER TABLE public.plannings
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'salle';
ALTER TABLE public.plannings DROP CONSTRAINT IF EXISTS plannings_department_check;
ALTER TABLE public.plannings ADD CONSTRAINT plannings_department_check
  CHECK (department IN ('salle', 'cuisine'));

-- ------------------------------------------------------------
-- 2. Fin de contrat (CDD) + désactivation automatique
-- ------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS contract_end_date DATE;

CREATE OR REPLACE FUNCTION public.deactivate_expired_contracts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.employees
  SET active = false
  WHERE active = true
    AND contract_end_date IS NOT NULL
    AND contract_end_date < CURRENT_DATE;
$$;

-- ------------------------------------------------------------
-- 3. Indisponibilités partielles (OFF midi / OFF soir)
-- ------------------------------------------------------------
ALTER TABLE public.unavailabilities
  ADD COLUMN IF NOT EXISTS available_from  NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS available_until NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS hours_reduction NUMERIC(4,1);

-- ------------------------------------------------------------
-- 4. Horodatage de dernière modification d'un planning
-- ------------------------------------------------------------
ALTER TABLE public.plannings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plannings_set_updated_at ON public.plannings;
CREATE TRIGGER plannings_set_updated_at
  BEFORE UPDATE ON public.plannings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5. Un seul planning par (tenant, semaine, département)
--    Requis par le ON CONFLICT de save_planning_with_entries (migration 008).
--    Sans cette contrainte, toute sauvegarde échoue en 42P10.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plannings_unique_week_dept'
      AND conrelid = 'public.plannings'::regclass
  ) THEN
    ALTER TABLE public.plannings
      ADD CONSTRAINT plannings_unique_week_dept
      UNIQUE (tenant_id, week_start_date, department);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. role_id d'une entrée : optionnel (la cuisine n'en a pas) et
--    la suppression d'un rôle ne doit pas effacer l'historique.
-- ------------------------------------------------------------
ALTER TABLE public.planning_entries ALTER COLUMN role_id DROP NOT NULL;
ALTER TABLE public.planning_entries DROP CONSTRAINT IF EXISTS planning_entries_role_id_fkey;
ALTER TABLE public.planning_entries ADD CONSTRAINT planning_entries_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 7. Accès super_admin + isolation des profils
--    001 déclarait profile_isolation sur tenant_id, ce qui laissait un
--    utilisateur écrire sur le profil de ses collègues. La production est
--    passée à `id = auth.uid()` ; on l'inscrit ici.
--    (La migration 007 empêche par ailleurs l'auto-promotion.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS profile_isolation       ON public.profiles;
DROP POLICY IF EXISTS profiles_select_sadmin  ON public.profiles;
DROP POLICY IF EXISTS profiles_update_sadmin  ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_sadmin  ON public.profiles;

CREATE POLICY profile_isolation ON public.profiles
  FOR ALL USING (id = auth.uid());
CREATE POLICY profiles_select_sadmin ON public.profiles
  FOR SELECT USING (
    public.is_super_admin() OR id = auth.uid() OR tenant_id = public.get_tenant_id()
  );
CREATE POLICY profiles_update_sadmin ON public.profiles
  FOR UPDATE USING (public.is_super_admin() OR id = auth.uid());
CREATE POLICY profiles_delete_sadmin ON public.profiles
  FOR DELETE USING (public.is_super_admin());

DROP POLICY IF EXISTS tenants_select_all_sadmin ON public.tenants;
DROP POLICY IF EXISTS tenants_insert_sadmin     ON public.tenants;
DROP POLICY IF EXISTS tenants_update_sadmin     ON public.tenants;
DROP POLICY IF EXISTS tenants_delete_sadmin     ON public.tenants;

CREATE POLICY tenants_select_all_sadmin ON public.tenants
  FOR SELECT USING (public.is_super_admin() OR id = public.get_tenant_id());
CREATE POLICY tenants_insert_sadmin ON public.tenants
  FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY tenants_update_sadmin ON public.tenants
  FOR UPDATE USING (public.is_super_admin() OR id = public.get_tenant_id());
CREATE POLICY tenants_delete_sadmin ON public.tenants
  FOR DELETE USING (public.is_super_admin());
