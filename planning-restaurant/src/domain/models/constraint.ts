/**
 * Contraintes de disponibilité des employés.
 *
 * Types :
 * - "fixed" : indisponibilité récurrente (ex: "jamais le mardi")
 * - "punctual" : indisponibilité ponctuelle (ex: "indispo le 15/04/2026")
 *
 * Time restrictions (optional, for punctual):
 * - availableFrom: employee available only FROM this hour (ex: 14.0 = dispo à partir de 14h)
 * - availableUntil: employee must leave BY this hour (ex: 18.0 = doit partir à 18h)
 * - Both null = OFF complet (pas dispo du tout)
 *
 * hoursReduction (optional, for punctual):
 * - Nombre d'heures à retirer du contrat hebdo pour cette semaine.
 * - Ex: 7 = le salarié a 7h de moins à faire cette semaine.
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
  hoursReduction: number | null
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
