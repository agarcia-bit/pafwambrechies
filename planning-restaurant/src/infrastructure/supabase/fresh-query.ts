import { freshClient } from './client'

/**
 * Exécute une query Supabase via un client frais (pas de state machine partagé).
 * Récupère le JWT depuis localStorage pour l'authentification.
 * Garantit qu'aucun deadlock du client principal ne bloque la requête.
 */
export async function freshQuery<T>(
  queryFn: (client: ReturnType<typeof freshClient>) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  // Récupère le JWT depuis localStorage
  let token: string | undefined
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k)
        if (raw) {
          const parsed = JSON.parse(raw)
          token = parsed?.access_token ?? parsed?.currentSession?.access_token
          break
        }
      }
    }
  } catch { /* continue with anon */ }

  const client = freshClient()
  if (token) {
    await client.auth.setSession({
      access_token: token,
      refresh_token: '',
    }).catch(() => {})
  }

  const { data, error } = await queryFn(client)
  if (error) throw new Error(error.message)
  return data as T
}
