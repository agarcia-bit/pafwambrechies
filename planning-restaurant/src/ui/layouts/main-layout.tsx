import { type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/ui/components'
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
} from 'lucide-react'

interface MainLayoutProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
}

const NAV_SECTIONS = [
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
      { id: 'planning', label: 'Générer un planning', icon: Calendar },
    ],
  },
  {
    label: '',
    items: [
      { id: 'settings', label: 'Paramètres', icon: Settings },
    ],
  },
]

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const { signOut } = useAuthStore()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-muted/30">
        <div className="border-b border-border p-6">
          <h1 className="text-lg font-bold text-primary">
            Planning Restaurant
          </h1>
        </div>

        <nav className="flex-1 overflow-auto p-4">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className="mb-4">
              {section.label && (
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        currentPage === item.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3"
            onClick={signOut}
          >
            <LogOut size={18} />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  )
}
