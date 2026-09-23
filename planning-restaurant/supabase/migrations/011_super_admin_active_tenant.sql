-- ============================================================
-- Bascule de tenant pour les super administrateurs
-- ============================================================
-- Toutes les policies d'isolation (employees, roles, shift_templates,
-- plannings, planning_entries, unavailabilities, daily_forecasts,
-- employee_roles, conditional_availabilities, manager_fixed_schedules,
-- daily_requirements) s'appuient sur get_tenant_id().
--
-- Un sélecteur purement côté interface serait donc sans effet : la base
-- continuerait de filtrer sur le tenant de rattachement du profil, et le
-- super_admin verrait une application vide après bascule.
--
-- On centralise la bascule dans get_tenant_id() plutôt que d'ajouter
-- « OR is_super_admin() » à onze policies : un seul point à faire évoluer,
-- aucun risque d'en oublier une, et l'isolation reste stricte pour tous les
-- autres rôles.
--
-- Le tenant actif est stocké en base et non côté client : il doit être
-- opposable au moteur RLS, il ne peut donc pas venir du navigateur.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_tenant_id IS
  'Tenant consulté par un super_admin. NULL = son tenant de rattachement. Ignoré pour les autres rôles.';

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN p.role = 'super_admin'
             THEN coalesce(p.active_tenant_id, p.tenant_id)
           ELSE p.tenant_id
         END
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- SECURITY DEFINER pour écrire sur le profil sans dépendre des policies ;
-- le contrôle de rôle est fait explicitement dans le corps.
CREATE OR REPLACE FUNCTION public.set_active_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé aux super administrateurs'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_tenant_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant introuvable' USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.profiles
  SET active_tenant_id = p_tenant_id
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_active_tenant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;

-- Le garde-fou anti-escalade (migration 007) doit couvrir la nouvelle
-- colonne : sans cela, un compte non super_admin se déplacerait d'un tenant
-- à l'autre en écrivant directement active_tenant_id sur son profil.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle non autorisée'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Modification du tenant non autorisée'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.active_tenant_id IS DISTINCT FROM OLD.active_tenant_id THEN
    RAISE EXCEPTION 'Changement de tenant actif non autorisé'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;
