import { type ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { useTenantStore } from '@/store/tenant-store'
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
  const { signOut, tenantId, role } = useAuthStore()
  const { employees, loaded: employeesLoaded, load: loadEmployees } = useEmployeeStore()
  const { employeeRoles, loaded: rolesLoaded, load: loadRoles } = useRoleStore()
  const { tenant, load: loadTenant } = useTenantStore()

  const isSuperAdmin = role === 'super_admin'
  const navSections = isSuperAdmin
    ? [...NAV_SECTIONS_STANDARD, NAV_SECTION_ADMIN]
    : NAV_SECTIONS_STANDARD

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-slate-900 text-slate-300">
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
                      onClick={() => onNavigate(item.id)}
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
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
