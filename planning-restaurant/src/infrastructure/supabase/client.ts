import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Bug connu de Supabase JS v2: le lock par défaut basé sur navigator.locks
    // peut deadlock quand on change d'onglet et qu'on revient (le lock reste
    // tenu par un onglet fermé/inactif). Conséquence: tous les appels au SDK
    // hangent indéfiniment après un tab switch.
    // Fix: lock no-op (on n'a qu'un seul onglet actif à la fois en pratique).
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(15000),
      })
    },
  },
})
