/**
 * Contraintes de disponibilité des employés.
 */
export type UnavailabilityType = 'fixed' | 'punctual'

export interface Unavailability {
  id: string
  employeeId: string
  type: UnavailabilityType
  dayOfWeek: number | null
  specificDate: string | null
  availableFrom: number | null
  availableUntil: number | null
  label: string
  hoursReduction?: number | null
}

export interface ManagerFixedSchedule {
  id: string
  employeeId: string
  dayOfWeek: number
  shiftTemplateId: string | null
  startTime: number | null
  endTime: number | null
}

export interface ConditionalAvailability {
  id: string
  employeeId: string
  dayOfWeek: number
  allowedShiftCodes: string[]
  maxHours: number | null
}
