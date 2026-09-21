-- NOTE D'ORDONNANCEMENT
-- Les policies ci-dessous utilisent public.is_super_admin(). Postgres résout la
-- fonction au moment du CREATE POLICY : sans cette définition, un `db reset`
-- sur une base vierge échouait ici ("function public.is_super_admin() does not
-- exist") et les migrations suivantes n'étaient jamais appliquées.
-- La migration 005 la redéfinit à l'identique (CREATE OR REPLACE), ce qui reste
-- sans effet — elle y élargit surtout le CHECK du rôle.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE TABLE monthly_actuals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  actual_revenue NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year, month)
);

ALTER TABLE monthly_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_actuals_select" ON monthly_actuals FOR SELECT
  USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());
CREATE POLICY "monthly_actuals_insert" ON monthly_actuals FOR INSERT
  WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_super_admin());
CREATE POLICY "monthly_actuals_update" ON monthly_actuals FOR UPDATE
  USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());
CREATE POLICY "monthly_actuals_delete" ON monthly_actuals FOR DELETE
  USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());
