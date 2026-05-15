const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function getStoredToken(): string {
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
