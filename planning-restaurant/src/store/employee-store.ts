import { create } from 'zustand'
import type { Employee } from '@/domain/models/employee'
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '@/infrastructure/supabase/repositories/employee-repo'

interface EmployeeState {
  employees: Employee[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (employee: Omit<Employee, 'id' | 'createdAt'>) => Promise<void>
  update: (id: string, updates: Partial<Employee>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const employees = await fetchEmployees()
      set({ employees, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (employee) => {
    set({ loading: true, error: null })
    try {
      const created = await createEmployee(employee)
      set((state) => ({
        employees: [...state.employees, created],
        loading: false,
      }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  update: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const updated = await updateEmployee(id, updates)
      set((state) => ({
        employees: state.employees.map((emp) =>
          emp.id === id ? updated : emp,
        ),
        loading: false,
      }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  remove: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteEmployee(id)
      set((state) => ({
        employees: state.employees.filter((emp) => emp.id !== id),
        loading: false,
      }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
