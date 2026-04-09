import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { LoginPage } from '@/ui/pages/login'
import { DashboardPage } from '@/ui/pages/dashboard'
import { EmployeesPage } from '@/ui/pages/employees'
import { PlanningPage } from '@/ui/pages/planning'
import { SettingsPage } from '@/ui/pages/settings'
import { MainLayout } from '@/ui/layouts/main-layout'

export default function App() {
  const { session, initialized, initialize } = useAuthStore()
  const [currentPage, setCurrentPage] = useState('dashboard')

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

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    employees: <EmployeesPage />,
    planning: <PlanningPage />,
    settings: <SettingsPage />,
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pages[currentPage] ?? <DashboardPage />}
    </MainLayout>
  )
}
