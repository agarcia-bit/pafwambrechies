import { supabase } from '../client'
import type { Role, EmployeeRole } from '@/domain/models/role'

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapRole)
}

export async function createRole(role: Omit<Role, 'id'>): Promise<Role> {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      tenant_id: role.tenantId,
      name: role.name,
      color: role.color,
      sort_order: role.sortOrder,
    })
    .select()
    .single()
  if (error) throw error
  return mapRole(data)
}

export async function updateRole(id: string, updates: Partial<Role>): Promise<Role> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

  const { data, error } = await supabase.from('roles').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error
  return mapRole(data)
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) throw error
}

// Employee-Role associations
export async function fetchEmployeeRoles(): Promise<EmployeeRole[]> {
  const { data, error } = await supabase.from('employee_roles').select('*')
  if (error) throw error
  return (data ?? []).map((r) => ({
    employeeId: r.employee_id,
    roleId: r.role_id,
  }))
}

export async function setEmployeeRoles(employeeId: string, roleIds: string[]): Promise<void> {
  // Delete existing
  const { error: delErr } = await supabase
    .from('employee_roles')
    .delete()
    .eq('employee_id', employeeId)
  if (delErr) throw delErr

  // Insert new
  if (roleIds.length > 0) {
    const { error: insErr } = await supabase
      .from('employee_roles')
      .insert(roleIds.map((roleId) => ({ employee_id: employeeId, role_id: roleId })))
    if (insErr) throw insErr
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRole(row: any): Role {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  }
}
