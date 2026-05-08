import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function getToken(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k)
        if (raw) {
          const parsed = JSON.parse(raw)
          return parsed?.access_token ?? parsed?.currentSession?.access_token ?? supabaseAnonKey
        }
      }
    }
  } catch { /* fallback */ }
  return supabaseAnonKey
}

/**
 * Exécute une query via un client Supabase frais avec le JWT injecté en header.
 * Contourne tout deadlock du client principal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function freshQuery<T>(
  queryFn: (client: any) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const token = getToken()

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (url, options) => fetch(url, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(10000),
      }),
    },
  })

  const { data, error } = await queryFn(client)
  if (error) throw new Error(error.message)
  return data as T
}
