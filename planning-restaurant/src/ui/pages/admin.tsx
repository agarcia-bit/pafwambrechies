import { useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/ui/components'
import {
  fetchAllTenants,
  fetchAllUsers,
  createTenant,
  deleteTenant,
  createUser,
  updateUser,
  deleteUser,
  countUsersPerTenant,
  type AdminUser,
} from '@/infrastructure/supabase/repositories/admin-repo'
import type { Tenant } from '@/domain/models/tenant'
import { Building2, Users as UsersIcon, Plus, Trash2, Shield, Copy } from 'lucide-react'

type Tab = 'tenants' | 'users'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('tenants')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [t, u] = await Promise.all([fetchAllTenants(), fetchAllUsers()])
      setTenants(t)
      setUsers(u)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const userCounts = countUsersPerTenant(users)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
          <Shield size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-sm text-muted-foreground">Gestion des tenants et des comptes utilisateurs</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('tenants')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'tenants' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Building2 size={14} className="mr-1 inline" /> Tenants ({tenants.length})
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <UsersIcon size={14} className="mr-1 inline" /> Utilisateurs ({users.length})
        </button>
      </div>

      {tab === 'tenants' && (
        <TenantsTab
          tenants={tenants}
          userCounts={userCounts}
          loading={loading}
          onReload={loadAll}
        />
      )}

      {tab === 'users' && (
        <UsersTab
          users={users}
          tenants={tenants}
          loading={loading}
          onReload={loadAll}
        />
      )}
    </div>
  )
}

// ---------------- Tenants Tab ----------------
function TenantsTab({
  tenants, userCounts, loading, onReload,
}: {
  tenants: Tenant[]
  userCounts: Record<string, number>
  loading: boolean
  onReload: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createTenant({ name: name.trim(), address: address.trim() || null })
      setName('')
      setAddress('')
      setShowForm(false)
      onReload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tenant: Tenant) {
    const count = userCounts[tenant.id] ?? 0
    const msg = count > 0
      ? `Supprimer "${tenant.name}" ?\nATTENTION: ${count} utilisateur(s) seront orphelins (plus de tenant_id).\nTous les salariés, rôles, plannings, etc. seront supprimés.`
      : `Supprimer "${tenant.name}" ?\nTous les salariés, rôles, plannings, etc. seront supprimés.`
    if (!confirm(msg)) return
    try {
      await deleteTenant(tenant.id)
      onReload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Restaurants (tenants)</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} className="mr-1" /> Nouveau restaurant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Le Bistrot du Port" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium">Adresse (optionnel)</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving ? 'Création...' : 'Créer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        )}

        {loading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Adresse</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Utilisateurs</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">UUID</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />}
                      {t.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.address || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                      <UsersIcon size={10} /> {userCounts[t.id] ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-[180px]">{t.id}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(t.id)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copier l'UUID"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(t)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Aucun tenant</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- Users Tab ----------------
function UsersTab({
  users, tenants, loading, onReload,
}: {
  users: AdminUser[]
  tenants: Tenant[]
  loading: boolean
  onReload: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [role, setRole] = useState('manager')
  const [filterTenant, setFilterTenant] = useState('')
  const [saving, setSaving] = useState(false)

  function randomPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
    setPassword(out + '!')
  }

  async function handleCreate() {
    if (!email.trim() || !password.trim() || !tenantId) return
    setSaving(true)
    try {
      await createUser({
        email: email.trim(),
        password,
        fullName: fullName.trim() || email.trim(),
        tenantId,
        role,
      })
      alert(`Utilisateur créé.\n\nEmail: ${email}\nMot de passe: ${password}\n\n⚠️ Note bien ce mot de passe, il ne sera plus affiché.`)
      setEmail('')
      setPassword('')
      setFullName('')
      setTenantId('')
      setRole('manager')
      setShowForm(false)
      onReload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeTenant(user: AdminUser, newTenantId: string) {
    if (newTenantId === (user.tenantId ?? '')) return
    try {
      await updateUser({ userId: user.id, tenantId: newTenantId })
      onReload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleChangeRole(user: AdminUser, newRole: string) {
    if (newRole === user.role) return
    try {
      await updateUser({ userId: user.id, role: newRole })
      onReload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Supprimer le compte ${user.email} ?\nCette action est irréversible.`)) return
    try {
      await deleteUser(user.id)
      onReload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const filtered = filterTenant
    ? users.filter((u) => u.tenantId === filterTenant)
    : users

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Comptes utilisateurs</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              options={[
                { value: '', label: 'Tous les tenants' },
                ...tenants.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus size={14} className="mr-1" /> Nouveau compte
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gerant@client.fr" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Mot de passe initial</label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button size="sm" variant="outline" onClick={randomPassword}>Générer</Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nom complet</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tenant</label>
              <Select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                options={[
                  { value: '', label: '— Choisir —' },
                  ...tenants.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Rôle</label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'manager', label: 'Manager' },
                  { value: 'admin', label: 'Admin (tenant)' },
                  { value: 'super_admin', label: 'Super admin (fournisseur)' },
                ]}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!email || !password || !tenantId || saving}>
                {saving ? 'Création...' : 'Créer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {loading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tenant</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rôle</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{u.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.fullName || '—'}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={u.tenantId ?? ''}
                      onChange={(e) => handleChangeTenant(u, e.target.value)}
                      options={[
                        { value: '', label: '— Orphelin —' },
                        ...tenants.map((t) => ({ value: t.id, label: t.name })),
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u, e.target.value)}
                      options={[
                        { value: 'manager', label: 'Manager' },
                        { value: 'admin', label: 'Admin' },
                        { value: 'super_admin', label: 'Super admin' },
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(u)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer le compte"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
