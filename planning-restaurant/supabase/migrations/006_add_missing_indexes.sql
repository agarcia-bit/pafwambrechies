-- Add missing indexes for common query patterns

CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_manager_fixed_schedules_employee ON manager_fixed_schedules(employee_id);

CREATE INDEX IF NOT EXISTS idx_unavailabilities_employee_date ON unavailabilities(employee_id, specific_date);

CREATE INDEX IF NOT EXISTS idx_planning_entries_composite ON planning_entries(planning_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_daily_requirements_day ON daily_requirements(day_of_week);
