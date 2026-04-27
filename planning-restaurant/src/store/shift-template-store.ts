import { create } from 'zustand'
import type { ShiftTemplate } from '@/domain/models/shift'
import {
  fetchShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
} from '@/infrastructure/supabase/repositories/shift-template-repo'

interface ShiftTemplateState {
  templates: ShiftTemplate[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (template: Omit<ShiftTemplate, 'id'>) => Promise<void>
  update: (id: string, updates: Partial<ShiftTemplate>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useShiftTemplateStore = create<ShiftTemplateState>((set) => ({
  templates: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const templates = await fetchShiftTemplates()
      set({ templates, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (template) => {
    try {
      const created = await createShiftTemplate(template)
      set((s) => ({ templates: [...s.templates, created] }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  update: async (id, updates) => {
    try {
      const updated = await updateShiftTemplate(id, updates)
      set((s) => ({ templates: s.templates.map((t) => (t.id === id ? updated : t)) }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  remove: async (id) => {
    try {
      await deleteShiftTemplate(id)
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
