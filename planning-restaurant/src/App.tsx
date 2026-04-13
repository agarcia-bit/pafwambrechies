import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
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
import { MainLayout } from '@/ui/layouts/main-layout'

export default function App() {
  const { session, initialized, initialize } = useAuthStore()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [viewPlanningId, setViewPlanningId] = useState<string | null>(null)

  useEffect(() => {
    initialize()
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

  function handleViewPlanning(planningId: string) {
    setViewPlanningId(planningId)
    setCurrentPage('planning')
  }

  function handleNavigate(page: string) {
    setCurrentPage(page)
    if (page !== 'planning') setViewPlanningId(null)
  }

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage onViewPlanning={handleViewPlanning} />,
    employees: <EmployeesPage />,
    roles: <RolesPage />,
    'shift-templates': <ShiftTemplatesPage />,
    constraints: <ConstraintsPage />,
    forecasts: <ForecastsPage />,
    planning: <PlanningPage loadPlanningId={viewPlanningId} />,
    'kitchen-planning': <KitchenPlanningPage />,
    settings: <SettingsPage />,
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {pages[currentPage] ?? <DashboardPage onViewPlanning={handleViewPlanning} />}
    </MainLayout>
  )
}
