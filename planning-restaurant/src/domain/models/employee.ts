export type ContractType = 'cdi' | 'cdd' | 'extra' | 'apprenti'

export type EmployeeLevel = 1 | 2 | 2.5 | 3 | 4

export interface Employee {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  contractType: ContractType
  weeklyHours: number // Heures contrat hebdo (ex: 35, 24, 42)
  modulationRange: number // +/- heures de modulation (ex: 5)
  level: EmployeeLevel
  isManager: boolean
  active: boolean
  createdAt: string
}

/** Bornes min/max calculées pour une semaine */
export function getWeeklyBounds(employee: Employee): {
  min: number
  max: number
} {
  return {
    min: employee.weeklyHours - employee.modulationRange,
    max: employee.weeklyHours + employee.modulationRange,
  }
}
