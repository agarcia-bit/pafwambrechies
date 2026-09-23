-- ============================================================
-- Planning Restaurant — Schema initial
-- Multi-tenant avec Row Level Security
-- ============================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TENANTS (restaurants)
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  opening_time NUMERIC(4,1) NOT NULL DEFAULT 9.5,
  closing_time_week NUMERIC(4,1) NOT NULL DEFAULT 24.0,
  closing_time_sunday NUMERIC(4,1) NOT NULL DEFAULT 21.0,
  closed_days INTEGER[] NOT NULL DEFAULT '{0}', -- 0=lundi
  productivity_min NUMERIC(5,1) NOT NULL DEFAULT 80,
  productivity_max NUMERIC(5,1) NOT NULL DEFAULT 100,
  productivity_target NUMERIC(5,1) NOT NULL DEFAULT 95,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFILES (utilisateurs/gérants)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES (salariés)
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'cdi' CHECK (contract_type IN ('cdi', 'cdd', 'extra', 'apprenti')),
  weekly_hours NUMERIC(4,1) NOT NULL DEFAULT 35,
  modulation_range NUMERIC(3,1) NOT NULL DEFAULT 5,
  level NUMERIC(2,1) NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 2.5, 3, 4)),
  is_manager BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_tenant ON employees(tenant_id);

-- ============================================================
-- ROLES (postes : serveur, barman, chef, etc.)
-- ============================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- ============================================================
-- EMPLOYEE_ROLES (association employé ↔ rôle)
-- ============================================================
CREATE TABLE employee_roles (
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, role_id)
);

-- ============================================================
-- SHIFT_TEMPLATES (créneaux horaires autorisés)
-- ============================================================
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ouverture', 'midi', 'midi_long', 'journee', 'fermeture', 'soir', 'renfort')),
  start_time NUMERIC(4,1) NOT NULL,
  end_time NUMERIC(4,1) NOT NULL,
  effective_hours NUMERIC(4,1) NOT NULL,
  meals INTEGER NOT NULL DEFAULT 0,
  baskets INTEGER NOT NULL DEFAULT 0,
  applicability TEXT NOT NULL DEFAULT 'tue_sat' CHECK (applicability IN ('tue_sat', 'sat_only', 'sunday')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_shift_templates_tenant ON shift_templates(tenant_id);

-- ============================================================
-- UNAVAILABILITIES (indisponibilités employés)
-- ============================================================
CREATE TABLE unavailabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'punctual')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date DATE,
  label TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_unavailabilities_employee ON unavailabilities(employee_id);

-- ============================================================
-- CONDITIONAL_AVAILABILITIES (disponibilités conditionnelles)
-- ============================================================
CREATE TABLE conditional_availabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  allowed_shift_codes TEXT[] NOT NULL,
  max_hours NUMERIC(4,1)
);

CREATE INDEX idx_cond_avail_employee ON conditional_availabilities(employee_id);

-- ============================================================
-- MANAGER_FIXED_SCHEDULES (horaires fixes managers)
-- ============================================================
CREATE TABLE manager_fixed_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_template_id UUID REFERENCES shift_templates(id),
  start_time NUMERIC(4,1),
  end_time NUMERIC(4,1),
  UNIQUE(employee_id, day_of_week)
);

-- ============================================================
-- DAILY_FORECASTS (CA prévisionnel N-1)
-- ============================================================
CREATE TABLE daily_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  forecasted_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, month, day_of_week)
);

CREATE INDEX idx_forecasts_tenant ON daily_forecasts(tenant_id);

-- ============================================================
-- DAILY_REQUIREMENTS (besoins journaliers en rôles)
-- ============================================================
CREATE TABLE daily_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  required_count INTEGER NOT NULL DEFAULT 1,
  start_time NUMERIC(4,1) NOT NULL,
  end_time NUMERIC(4,1) NOT NULL
);

CREATE INDEX idx_requirements_tenant ON daily_requirements(tenant_id);

-- ============================================================
-- PLANNINGS (plannings générés)
-- ============================================================
CREATE TABLE plannings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_plannings_tenant ON plannings(tenant_id);

-- ============================================================
-- PLANNING_ENTRIES (affectations)
-- ============================================================
CREATE TABLE planning_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  date DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_template_id UUID NOT NULL REFERENCES shift_templates(id),
  start_time NUMERIC(4,1) NOT NULL,
  end_time NUMERIC(4,1) NOT NULL,
  effective_hours NUMERIC(4,1) NOT NULL,
  meals INTEGER NOT NULL DEFAULT 0,
  baskets INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_entries_planning ON planning_entries(planning_id);
CREATE INDEX idx_entries_employee ON planning_entries(employee_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Fonction helper : tenant_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Activer RLS sur toutes les tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE unavailabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_fixed_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE plannings ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;

-- Policies : chaque utilisateur ne voit que son tenant

CREATE POLICY tenant_isolation ON tenants
  FOR ALL USING (id = public.get_tenant_id());

CREATE POLICY profile_isolation ON profiles
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY employee_isolation ON employees
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY role_isolation ON roles
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY employee_role_isolation ON employee_roles
  FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE tenant_id = public.get_tenant_id())
  );

CREATE POLICY shift_template_isolation ON shift_templates
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY unavailability_isolation ON unavailabilities
  FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE tenant_id = public.get_tenant_id())
  );

CREATE POLICY cond_avail_isolation ON conditional_availabilities
  FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE tenant_id = public.get_tenant_id())
  );

CREATE POLICY manager_schedule_isolation ON manager_fixed_schedules
  FOR ALL USING (
    employee_id IN (SELECT id FROM employees WHERE tenant_id = public.get_tenant_id())
  );

CREATE POLICY forecast_isolation ON daily_forecasts
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY requirement_isolation ON daily_requirements
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY planning_isolation ON plannings
  FOR ALL USING (tenant_id = public.get_tenant_id());

CREATE POLICY entry_isolation ON planning_entries
  FOR ALL USING (
    planning_id IN (SELECT id FROM plannings WHERE tenant_id = public.get_tenant_id())
  );
