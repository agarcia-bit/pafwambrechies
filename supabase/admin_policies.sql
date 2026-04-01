-- ============================================================
-- Politiques RLS pour l'interface d'administration PAF
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- Fonction utilitaire (évite de répéter la sous-requête dans chaque policy)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── actus ─────────────────────────────────────────────────────
CREATE POLICY "Admins can insert actus" ON public.actus
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update actus" ON public.actus
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete actus" ON public.actus
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── offres ────────────────────────────────────────────────────
CREATE POLICY "Admins can insert offres" ON public.offres
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update offres" ON public.offres
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete offres" ON public.offres
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── evenements ────────────────────────────────────────────────
CREATE POLICY "Admins can insert evenements" ON public.evenements
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update evenements" ON public.evenements
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete evenements" ON public.evenements
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── annuaire ──────────────────────────────────────────────────
CREATE POLICY "Admins can insert annuaire" ON public.annuaire
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update annuaire" ON public.annuaire
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete annuaire" ON public.annuaire
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── idees (modération) ────────────────────────────────────────
CREATE POLICY "Admins can update idees" ON public.idees
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete idees" ON public.idees
  FOR DELETE TO authenticated USING (public.is_admin());
