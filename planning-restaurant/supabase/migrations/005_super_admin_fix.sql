-- Fix: ajouter le rôle super_admin au CHECK constraint
-- et créer la fonction is_super_admin() référencée dans 004_monthly_actuals.sql

-- 1. Élargir le CHECK constraint pour accepter super_admin
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'super_admin'));

-- 2. Créer la fonction is_super_admin() (SECURITY DEFINER pour bypass RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
