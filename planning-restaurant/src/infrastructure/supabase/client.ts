import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env',
  )
}

const clientOptions = {
  auth: {
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => await fn(),
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) => {
      return fetch(url, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(15000),
      })
    },
  },
}

// Client principal (utilisé pour l'auth: login, session, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)

// Client secondaire pour les requêtes data: si le client principal est
// dans un état corrompu (deadlock auth), celui-ci reste fonctionnel car
// il ne partage pas l'état interne (locks, refresh timers, etc.)
// On le recrée à chaque appel pour garantir un état propre.
export function freshClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...clientOptions,
    auth: {
      ...clientOptions.auth,
      persistSession: false, // pas de conflit de storage avec le client principal
    },
  })
}
