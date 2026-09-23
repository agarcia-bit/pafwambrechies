-- ============================================================
-- SÉCURITÉ : expose moins de fonctions via l'API REST
-- ============================================================
-- Remonté par l'analyseur de sécurité Supabase après le déploiement.
--
-- Faille principale — `deactivate_expired_contracts()` :
--   SECURITY DEFINER (donc hors RLS), elle ÉCRIT
--   (UPDATE employees SET active = false), et PostgreSQL l'exposait à `anon`.
--   N'importe quelle requête non authentifiée munie de la clé publique
--   pouvait donc désactiver les contrats expirés de TOUS les tenants via
--   /rest/v1/rpc/deactivate_expired_contracts. Le frontend ne l'appelle
--   jamais : la désactivation se fait côté client, salarié par salarié.
--
-- Fonctions de trigger exposées — handle_new_user,
--   prevent_profile_privilege_escalation, set_updated_at :
--   elles n'ont de sens qu'appelées par le moteur de triggers, qui ne vérifie
--   pas le privilège EXECUTE de l'appelant. Les révoquer ferme leur endpoint
--   REST sans casser les triggers (vérifié).
--
-- search_path modifiable :
--   sur une fonction SECURITY DEFINER, c'est un vecteur d'escalade — l'appel
--   peut être détourné vers un objet homonyme placé dans un schéma prioritaire.
--
-- Point d'attention : PostgreSQL accorde EXECUTE à PUBLIC par défaut, et
-- `anon`/`authenticated` en héritent. Révoquer nommément sur ces deux rôles ne
-- retire rien ; il faut révoquer sur PUBLIC.

ALTER FUNCTION public.is_super_admin()               SET search_path = public;
ALTER FUNCTION public.get_tenant_id()                SET search_path = public;
ALTER FUNCTION public.handle_new_user()              SET search_path = public;
ALTER FUNCTION public.deactivate_expired_contracts() SET search_path = public;
ALTER FUNCTION public.set_updated_at()               SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.deactivate_expired_contracts()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                       FROM PUBLIC, anon, authenticated;

-- get_tenant_id() et is_super_admin() restent exécutables à dessein : les
-- policies RLS les évaluent avec les droits de l'appelant, les révoquer
-- couperait tout accès aux données. Elles sont en lecture seule et ne
-- révèlent que le tenant et le rôle de l'appelant lui-même.
GRANT EXECUTE ON FUNCTION public.get_tenant_id()  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
