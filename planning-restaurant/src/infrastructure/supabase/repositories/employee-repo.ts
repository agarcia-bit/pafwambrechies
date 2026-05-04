import { supabase } from '../client'
import type { Employee } from '@/domain/models/employee'

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('is_manager', { ascending: false })
    .order('level', { ascending: false })
    .order('weekly_hours', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapEmployee)
}

export async function createEmployee(
  employee: Omit<Employee, 'id' | 'createdAt'>,
): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      tenant_id: employee.tenantId,
      first_name: employee.firstName,
      last_name: employee.lastName,
      contract_type: employee.contractType,
      weekly_hours: employee.weeklyHours,
      modulation_range: employee.modulationRange,
      level: employee.level,
      is_manager: employee.isManager,
      department: employee.department,
      active: employee.active,
    })
    .select()
    .single()

  if (error) throw error
  return mapEmployee(data)
}

export async function updateEmployee(
  id: string,
  updates: Partial<Omit<Employee, 'id' | 'tenantId' | 'createdAt'>>,
): Promise<Employee> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName
  if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName
  if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType
  if (updates.weeklyHours !== undefined) dbUpdates.weekly_hours = updates.weeklyHours
  if (updates.modulationRange !== undefined) dbUpdates.modulation_range = updates.modulationRange
  if (updates.level !== undefined) dbUpdates.level = updates.level
  if (updates.isManager !== undefined) dbUpdates.is_manager = updates.isManager
  if (updates.department !== undefined) dbUpdates.department = updates.department
  if (updates.active !== undefined) dbUpdates.active = updates.active

  const { data, error } = await supabase
    .from('employees')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapEmployee(data)
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(row: any): Employee {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    contractType: row.contract_type,
    weeklyHours: Number(row.weekly_hours),
    modulationRange: Number(row.modulation_range),
    level: Number(row.level) as Employee['level'],
    isManager: row.is_manager,
    department: row.department ?? 'salle',
    active: row.active,
    createdAt: row.created_at,
  }
}
