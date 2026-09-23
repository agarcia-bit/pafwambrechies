-- ============================================================
-- SÉCURITÉ : empêche l'escalade de privilèges via profiles
-- ============================================================
-- Faille corrigée :
--   La policy RLS `profile_isolation` autorise `id = auth.uid()`, donc un
--   utilisateur peut écrire sur sa propre ligne. Le rôle `authenticated`
--   possède par ailleurs le droit UPDATE sur la colonne `role`. Résultat :
--   n'importe quel compte connecté pouvait exécuter
--     UPDATE profiles SET role = 'super_admin' WHERE id = auth.uid();
--   et obtenir un accès super_admin cross-tenant (monthly_actuals, tenants,
--   surface d'administration).
--
-- Correctif :
--   Un trigger BEFORE UPDATE bloque toute modification de `role` ou
--   `tenant_id` par l'utilisateur lui-même.
--
-- Chemins légitimes préservés :
--   - Edge function `admin-users` (service_role) : auth.uid() est NULL
--   - Un super_admin existant : is_super_admin() renvoie true
--   - Un utilisateur éditant son propre nom/email : colonnes non protégées

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / contexte serveur (auth.uid() NULL) et super_admin : autorisés
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;

CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Défense en profondeur : anon n'a aucune raison d'écrire dans profiles.
REVOKE UPDATE, INSERT ON public.profiles FROM anon;
