import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/supabase/client'

interface AuthState {
  session: Session | null
  user: User | null
  tenantId: string | null
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  tenantId: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single()

      set({
        session,
        user: session.user,
        tenantId: profile?.tenant_id ?? null,
        initialized: true,
      })
    } else {
      set({ initialized: true })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()

        set({
          session,
          user: session.user,
          tenantId: profile?.tenant_id ?? null,
        })
      } else {
        set({ session: null, user: null, tenantId: null })
      }
    })
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, tenantId: null })
  },
}))
