-- ── Contrôle de sécurité de Supabase (24/11/2026) ───────────────────────────────────────────────
-- Ce que le contrôle automatique a relevé dans le schéma public, et ce qu'on en fait.
-- Script rejouable sans risque.

-- 1. Chemin de recherche fixé : une fonction sans search_path pourrait, en théorie, appeler une
--    fonction du même nom placée ailleurs. (Aussi corrigé dans creneaux.sql,
--    propositions_evenements.sql et multi_tenant_migration.sql, pour qu'un script rejoué le garde.)
alter function public.profiles_forbid_tenant_change() set search_path = public;
alter function public.besoin_du_creneau(public.poles, time) set search_path = public;
alter function public.seances_de_la_serie(date, text, smallint) set search_path = public;

-- 2. Fonctions de déclencheurs : elles ne servent qu'à la base elle-même, personne n'a à les
--    appeler. On retire le droit d'exécution aux visiteurs et aux membres.
revoke execute on function public.annuaire_delete_with_profile() from public, anon, authenticated;
revoke execute on function public.bureau_message_auteur() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.offres_delete_with_profile() from public, anon, authenticated;
revoke execute on function public.profiles_forbid_tenant_change() from public, anon, authenticated;

-- Laissé tel quel, volontairement :
--  * les fonctions d'inscription (resolve_signup_code, signup_eligibility, signup_prefill,
--    validate_signup_code) et get_public_branding : appelées avant connexion, c'est leur rôle ;
--  * current_tenant_id, is_admin, is_bureau_or_admin : lues par les règles d'accès des tables ;
--    pour un visiteur non connecté, elles ne rendent rien ;
--  * les tables sans règle d'accès (visites, lectures, rappels…) : fermées à tous les membres,
--    on n'y passe que par des fonctions qui vérifient qui demande ;
--  * les fonctions des membres et du bureau : chacune vérifie elle-même l'association et le rôle.
