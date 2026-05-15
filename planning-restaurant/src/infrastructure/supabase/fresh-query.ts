import { createClient } from '@supabase/supabase-js'
import { getStoredToken } from '@/lib/auth-token'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Exécute une query via un client Supabase frais avec le JWT injecté en header.
 * Contourne tout deadlock du client principal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function freshQuery<T>(
  queryFn: (client: any) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const token = getStoredToken()

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
