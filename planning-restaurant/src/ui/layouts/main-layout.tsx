import { type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/ui/components'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  LogOut,
} from 'lucide-react'

interface MainLayoutProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'employees', label: 'Salariés', icon: Users },
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'settings', label: 'Paramètres', icon: Settings },
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

        <nav className="flex-1 p-4">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
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
