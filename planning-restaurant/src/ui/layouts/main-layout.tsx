import { type ReactNode, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { useTenantStore } from '@/store/tenant-store'
import { fetchAllTenants, setActiveTenant } from '@/infrastructure/supabase/repositories/admin-repo'
import {
  LayoutDashboard,
  Users,
  Tags,
  Clock,
  ShieldAlert,
  TrendingUp,
  Calendar,
  Settings,
  LogOut,
  ChefHat,
  Utensils,
  Shield,
  Menu,
  X,
} from 'lucide-react'

interface MainLayoutProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
}

const NAV_SECTIONS_STANDARD = [
  {
    label: '',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'employees', label: 'Salariés', icon: Users },
      { id: 'roles', label: 'Rôles', icon: Tags },
      { id: 'shift-templates', label: 'Créneaux horaires', icon: Clock },
      { id: 'constraints', label: 'Disponibilités', icon: ShieldAlert },
      { id: 'forecasts', label: 'CA Prévisionnel', icon: TrendingUp },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'planning', label: 'Planning salle', icon: Calendar },
      { id: 'kitchen-planning', label: 'Planning cuisine', icon: ChefHat },
    ],
  },
  {
    label: '',
    items: [
      { id: 'settings', label: 'Paramètres', icon: Settings },
    ],
  },
]

const NAV_SECTION_ADMIN = {
  label: 'Administration',
  items: [
    { id: 'admin', label: 'Tenants & comptes', icon: Shield },
  ],
}

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const { signOut, tenantId, role, user } = useAuthStore()
  const { employees, loaded: employeesLoaded, load: loadEmployees } = useEmployeeStore()
  const { employeeRoles, loaded: rolesLoaded, load: loadRoles } = useRoleStore()
  const { tenant, load: loadTenant } = useTenantStore()

  const isSuperAdmin = role === 'super_admin'
  const navSections = isSuperAdmin
    ? [...NAV_SECTIONS_STANDARD, NAV_SECTION_ADMIN]
    : NAV_SECTIONS_STANDARD

  // Sélecteur de tenant (super_admin uniquement)
  const [allTenants, setAllTenants] = useState<{ id: string; name: string }[]>([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchAllTenants()
      .then((list) => setAllTenants(list.map((t) => ({ id: t.id, name: t.name }))))
      .catch((e: unknown) => console.warn('[layout] tenants', e))
  }, [isSuperAdmin])

  async function handleSwitchTenant(newTenantId: string) {
    if (!newTenantId || newTenantId === tenantId) return
    setSwitching(true)
    try {
      await setActiveTenant(newTenantId)
      // Rechargement complet plutôt qu'un rafraîchissement des stores : tous
      // les caches (salariés, rôles, créneaux, plannings de la semaine en
      // cours) contiennent encore les données du tenant précédent. Les vider
      // un par un laisserait forcément passer quelque chose — afficher le
      // planning d'un autre restaurant serait pire qu'un rechargement.
      window.location.reload()
    } catch (e) {
      setSwitching(false)
      alert(`Changement de restaurant impossible : ${(e as Error).message}`)
    }
  }

  // Charge les données nécessaires au layout (badge rôles non attribués)
  useEffect(() => {
    if (tenantId) loadTenant(tenantId)
    loadEmployees()
    loadRoles()
  }, [tenantId, loadTenant, loadEmployees, loadRoles])

  // Update document title + favicon when tenant branding changes
  useEffect(() => {
    if (tenant?.name) {
      document.title = `${tenant.name} — Planning`
    }
    if (tenant?.logoUrl) {
      const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
      if (favicon) favicon.href = tenant.logoUrl
    }
  }, [tenant?.name, tenant?.logoUrl])

  // N'affiche le badge que quand les DEUX stores sont chargés
  // (sinon on a un faux positif pendant la race: employees loaded avant employeeRoles)
  const unassignedCount = (employeesLoaded && rolesLoaded)
    ? employees
        .filter((e) => e.active)
        .filter((e) => !employeeRoles.some((er) => er.employeeId === e.id))
        .length
    : 0

  const displayName = tenant?.name || 'Planning Restaurant'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleNav(page: string) {
    onNavigate(page)
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 bg-slate-900 px-4 md:hidden">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-300">
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="text-sm font-bold text-white truncate">{displayName}</span>
      </div>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-slate-900 text-slate-300 transition-transform md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} pt-14 md:pt-0`}>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={displayName} className="h-full w-full object-contain" />
            ) : (
              <Utensils size={18} className="text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white tracking-tight" title={displayName}>
              {displayName}
            </h1>
            <p className="mt-0.5 text-[10px] text-slate-500">Gestion des plannings</p>
          </div>
        </div>

        {/* Sélecteur de restaurant — super_admin uniquement.
            Masqué tant qu'il n'y a qu'un seul restaurant : un menu à une
            seule entrée n'apporterait rien. */}
        {isSuperAdmin && allTenants.length > 1 && (
          <div className="px-5 pb-4">
            <label htmlFor="tenant-switch" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Restaurant
            </label>
            <select
              id="tenant-switch"
              value={tenantId ?? ''}
              disabled={switching}
              onChange={(e) => handleSwitchTenant(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[13px] text-white disabled:opacity-50"
            >
              {allTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {switching && (
              <p className="mt-1 text-[10px] text-slate-500">Changement en cours…</p>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-auto px-3 pb-4">
          {navSections.map((section, si) => (
            <div key={si} className="mb-5">
              {section.label && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {section.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNav(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                        currentPage === item.id
                          ? 'bg-primary text-white shadow-md shadow-primary/25'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon size={16} strokeWidth={1.8} />
                      {item.label}
                      {item.id === 'roles' && unassignedCount > 0 && (
                        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                          {unassignedCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-700/50 px-3 py-3">
          {/* Compte connecté : les fonctions d'administration dépendent du
              rôle, sans cette mention il était impossible de comprendre
              pourquoi la section Administration n'apparaissait pas. */}
          {user?.email && (
            <div className="mb-2 px-3">
              <p className="truncate text-[11px] text-slate-400" title={user.email}>{user.email}</p>
              <p className="text-[10px] text-slate-600">
                {role === 'super_admin' ? 'Super administrateur'
                  : role === 'admin' ? 'Administrateur'
                  : role === 'manager' ? 'Manager' : (role ?? 'rôle inconnu')}
              </p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-all hover:bg-slate-800 hover:text-slate-300"
          >
            <LogOut size={16} strokeWidth={1.8} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
