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
 */
export type UnavailabilityType = 'fixed' | 'punctual'

export interface Unavailability {
  id: string
  employeeId: string
  type: UnavailabilityType
  dayOfWeek: number | null // 0=lundi..6=dimanche (pour "fixed")
  specificDate: string | null // ISO date (pour "punctual")
  availableFrom: number | null // ex: 14.0 = dispo à partir de 14h
  availableUntil: number | null // ex: 18.0 = doit partir à 18h
  label: string // Description libre
}

/**
 * Horaires fixes pour les managers.
 */
export interface ManagerFixedSchedule {
  id: string
  employeeId: string
  dayOfWeek: number // 0=lundi..6=dimanche
  shiftTemplateId: string | null // null = OFF ce jour
  startTime: number | null
  endTime: number | null
}

/**
 * Disponibilité conditionnelle (ex: "mer≥18h" = mercredi, uniquement créneau SOIR)
 */
export interface ConditionalAvailability {
  id: string
  employeeId: string
  dayOfWeek: number // 0=lundi..6=dimanche
  allowedShiftCodes: string[] // ex: ["SOIR"] pour "≥18h"
  maxHours: number | null // ex: 6 pour "sam≤6h"
}
