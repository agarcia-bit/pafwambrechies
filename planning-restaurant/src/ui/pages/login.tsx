import { useState, type FormEvent } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button, Input } from '@/ui/components'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { signIn, loading } = useAuthStore()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn(email, password)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-slate-900 bg-cover bg-center p-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1920&q=80')",
      }}
    >
      {/* Overlay sombre pour garder la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-900/85" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">
            Planning Restaurant
          </h1>
          <p className="mt-2 text-sm text-slate-200 drop-shadow">
            Connectez-vous pour accéder à votre espace
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="gerant@restaurant.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              id="password"
              label="Mot de passe"
              type="password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" disabled={loading} size="lg" className="mt-1 w-full">
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
