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
    // Bug connu de Supabase JS v2: le lock par défaut + l'auto-refresh
    // peuvent deadlock quand on change d'onglet et qu'on revient.
    // Fix: lock no-op + désactiver autoRefreshToken.
    // Le token JWT a 1h de validité. Si on est dans le tab >1h, on
    // demandera à l'utilisateur de se reconnecter via une vérification
    // d'expiration manuelle au moment des requêtes.
    lock: async (_name, _acquireTimeout, fn) => await fn(),
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
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
