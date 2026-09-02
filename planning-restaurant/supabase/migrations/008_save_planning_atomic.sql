-- ============================================================
-- Sauvegarde atomique d'un planning et de ses entrées
-- ============================================================
-- Remplace l'ancienne implémentation côté client (3 requêtes HTTP
-- indépendantes : upsert → DELETE entries → INSERT entries).
--
-- Deux défauts corrigés :
--
--   C4 — Atomicité. Le DELETE et le ré-INSERT n'étaient pas dans une
--        transaction. Un timeout, une coupure réseau ou la fermeture de
--        l'onglet entre les deux laissait le planning avec ZÉRO entrée :
--        la semaine de travail était perdue, et l'erreur était avalée par
--        un simple console.warn côté UI.
--
--   C2 — Préservation du statut. L'upsert renvoyait status='draft' à chaque
--        sauvegarde automatique. Ouvrir un planning validé et cliquer par
--        erreur sur une cellule le faisait repasser en brouillon, écrasant
--        silencieusement la version validée.
--        Ici ON CONFLICT ne touche NI `status` NI `created_by`.
--
-- SECURITY INVOKER (défaut) : les policies RLS du tenant s'appliquent
-- normalement, un utilisateur ne peut pas écrire chez un autre tenant.

CREATE OR REPLACE FUNCTION public.save_planning_with_entries(
  p_tenant_id       uuid,
  p_week_start_date date,
  p_week_number     int,
  p_department      text,
  p_created_by      uuid,
  p_entries         jsonb
)
RETURNS public.plannings
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_planning public.plannings;
BEGIN
  INSERT INTO public.plannings AS pl
    (tenant_id, week_start_date, week_number, status, created_by, department)
  VALUES
    (p_tenant_id, p_week_start_date, p_week_number, 'draft', p_created_by,
     coalesce(nullif(p_department, ''), 'salle'))
  ON CONFLICT (tenant_id, week_start_date, department) DO UPDATE
    SET week_number = EXCLUDED.week_number,
        updated_at  = now()
    -- status et created_by volontairement préservés
  RETURNING * INTO v_planning;

  DELETE FROM public.planning_entries WHERE planning_id = v_planning.id;

  IF p_entries IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO public.planning_entries (
      id, planning_id, employee_id, role_id, date, day_of_week,
      shift_template_id, start_time, end_time, effective_hours, meals, baskets
    )
    SELECT
      coalesce(nullif(e->>'id', '')::uuid, gen_random_uuid()),
      v_planning.id,
      (e->>'employee_id')::uuid,
      nullif(e->>'role_id', '')::uuid,
      (e->>'date')::date,
      (e->>'day_of_week')::int,
      (e->>'shift_template_id')::uuid,
      (e->>'start_time')::numeric,
      (e->>'end_time')::numeric,
      (e->>'effective_hours')::numeric,
      coalesce((e->>'meals')::int, 0),
      coalesce((e->>'baskets')::int, 0)
    FROM jsonb_array_elements(p_entries) AS e;
  END IF;

  RETURN v_planning;
END;
$$;

REVOKE ALL ON FUNCTION public.save_planning_with_entries(uuid, date, int, text, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_planning_with_entries(uuid, date, int, text, uuid, jsonb)
  TO authenticated;
