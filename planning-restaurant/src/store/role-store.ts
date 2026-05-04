import { create } from 'zustand'
import type { Role, EmployeeRole } from '@/domain/models/role'
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchEmployeeRoles,
  setEmployeeRoles,
} from '@/infrastructure/supabase/repositories/role-repo'

interface RoleState {
  roles: Role[]
  employeeRoles: EmployeeRole[]
  loading: boolean
  loaded: boolean
  error: string | null

  load: () => Promise<void>
  add: (role: Omit<Role, 'id'>) => Promise<void>
  update: (id: string, updates: Partial<Role>) => Promise<void>
  remove: (id: string) => Promise<void>
  assignRoles: (employeeId: string, roleIds: string[]) => Promise<void>
  getRolesForEmployee: (employeeId: string) => string[]
}

export const useRoleStore = create<RoleState>((set, get) => ({
  roles: [],
  employeeRoles: [],
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const [roles, employeeRoles] = await Promise.all([
        fetchRoles(),
        fetchEmployeeRoles(),
      ])
      set({ roles, employeeRoles, loading: false, loaded: true })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (role) => {
    try {
      const created = await createRole(role)
      set((s) => ({ roles: [...s.roles, created] }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  update: async (id, updates) => {
    try {
      const updated = await updateRole(id, updates)
      set((s) => ({ roles: s.roles.map((r) => (r.id === id ? updated : r)) }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  remove: async (id) => {
    try {
      await deleteRole(id)
      set((s) => ({ roles: s.roles.filter((r) => r.id !== id) }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  assignRoles: async (employeeId, roleIds) => {
    try {
      await setEmployeeRoles(employeeId, roleIds)
      set((s) => ({
        employeeRoles: [
          ...s.employeeRoles.filter((er) => er.employeeId !== employeeId),
          ...roleIds.map((roleId) => ({ employeeId, roleId })),
        ],
      }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  getRolesForEmployee: (employeeId) => {
    return get().employeeRoles.filter((er) => er.employeeId === employeeId).map((er) => er.roleId)
  },
}))
