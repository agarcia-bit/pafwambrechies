import { create } from 'zustand'
import type { Tenant, TenantRules } from '@/domain/models/tenant'
import { fetchTenant, updateTenant as updateTenantRepo } from '@/infrastructure/supabase/repositories/tenant-repo'

interface TenantState {
  tenant: Tenant | null
  loading: boolean
  error: string | null

  load: (tenantId: string) => Promise<void>
  update: (tenantId: string, patch: Partial<Omit<Tenant, 'id' | 'createdAt'>>) => Promise<void>
  updateRules: (tenantId: string, rules: TenantRules) => Promise<void>
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  loading: false,
  error: null,

  load: async (tenantId) => {
    set({ loading: true, error: null })
    try {
      const tenant = await fetchTenant(tenantId)
      set({ tenant, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  update: async (tenantId, patch) => {
    set({ loading: true, error: null })
    try {
      const updated = await updateTenantRepo(tenantId, patch)
      set({ tenant: updated, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateRules: async (tenantId, rules) => {
    set({ loading: true, error: null })
    try {
      const updated = await updateTenantRepo(tenantId, { rules })
      set({ tenant: updated, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
