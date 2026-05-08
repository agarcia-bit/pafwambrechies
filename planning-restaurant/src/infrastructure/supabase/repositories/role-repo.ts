import { freshQuery } from '../fresh-query'
import type { Role, EmployeeRole } from '@/domain/models/role'

export async function fetchRoles(): Promise<Role[]> {
  const data = await freshQuery((c) =>
    c.from('roles').select('*').order('sort_order'),
  )
  return ((data as Record<string, unknown>[]) ?? []).map(mapRole)
}

export async function createRole(role: Omit<Role, 'id'>): Promise<Role> {
  const data = await freshQuery((c) =>
    c.from('roles').insert({
      tenant_id: role.tenantId,
      name: role.name,
      color: role.color,
      sort_order: role.sortOrder,
    }).select().single(),
  )
  return mapRole(data as Record<string, unknown>)
}

export async function updateRole(id: string, updates: Partial<Role>): Promise<Role> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

  const data = await freshQuery((c) =>
    c.from('roles').update(dbUpdates).eq('id', id).select().single(),
  )
  return mapRole(data as Record<string, unknown>)
}

export async function deleteRole(id: string): Promise<void> {
  await freshQuery((c) => c.from('roles').delete().eq('id', id).select())
}

// Employee-Role associations
export async function fetchEmployeeRoles(): Promise<EmployeeRole[]> {
  const data = await freshQuery((c) =>
    c.from('employee_roles').select('*'),
  )
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    employeeId: r.employee_id as string,
    roleId: r.role_id as string,
  }))
}

export async function setEmployeeRoles(employeeId: string, roleIds: string[]): Promise<void> {
  // Delete existing
  await freshQuery((c) => c.from('employee_roles').delete().eq('employee_id', employeeId).select())

  // Insert new
  if (roleIds.length > 0) {
    await freshQuery((c) =>
      c.from('employee_roles').insert(roleIds.map((roleId) => ({ employee_id: employeeId, role_id: roleId }))).select(),
    )
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
