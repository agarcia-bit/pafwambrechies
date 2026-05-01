import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { supabase } from '@/infrastructure/supabase/client'
import { LoginPage } from '@/ui/pages/login'
import { DashboardPage } from '@/ui/pages/dashboard'
import { EmployeesPage } from '@/ui/pages/employees'
import { RolesPage } from '@/ui/pages/roles'
import { ShiftTemplatesPage } from '@/ui/pages/shift-templates'
import { ConstraintsPage } from '@/ui/pages/constraints'
import { ForecastsPage } from '@/ui/pages/forecasts'
import { PlanningPage } from '@/ui/pages/planning'
import { KitchenPlanningPage } from '@/ui/pages/kitchen-planning'
import { SettingsPage } from '@/ui/pages/settings'
import { AdminPage } from '@/ui/pages/admin'
import { MainLayout } from '@/ui/layouts/main-layout'

export default function App() {
  const { session, initialized, initialize } = useAuthStore()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [viewPlanningId, setViewPlanningId] = useState<string | null>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  // Watchdog: quand l'utilisateur revient sur l'onglet après une absence,
  // refresh la session Supabase pour éviter les requêtes avec un JWT expiré.
  // Sinon, après une heure d'inactivité, les pages "chargent dans le vide"
  // (RLS retourne 0 ligne avec un token expiré).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession().catch(() => {
          // Si le refresh échoue, on relance l'init complet
          initialize()
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [initialize])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  function handleViewPlanning(planningId: string, department?: string) {
    setViewPlanningId(planningId)
    setCurrentPage(department === 'cuisine' ? 'kitchen-planning' : 'planning')
  }

  function handleNavigate(page: string) {
    setCurrentPage(page)
    if (page !== 'planning' && page !== 'kitchen-planning') setViewPlanningId(null)
  }

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage onViewPlanning={handleViewPlanning} />,
    employees: <EmployeesPage />,
    roles: <RolesPage />,
    'shift-templates': <ShiftTemplatesPage />,
    constraints: <ConstraintsPage />,
    forecasts: <ForecastsPage />,
    planning: <PlanningPage loadPlanningId={viewPlanningId} />,
    'kitchen-planning': <KitchenPlanningPage loadPlanningId={viewPlanningId} />,
    settings: <SettingsPage />,
    admin: <AdminPage />,
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {pages[currentPage] ?? <DashboardPage onViewPlanning={handleViewPlanning} />}
    </MainLayout>
  )
}
