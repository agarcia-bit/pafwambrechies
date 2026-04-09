/**
 * Contraintes de disponibilité des employés.
 *
 * Types :
 * - "fixed" : indisponibilité récurrente (ex: "jamais le mardi")
 * - "punctual" : indisponibilité ponctuelle (ex: "indispo le 15/04/2026")
 * - "preference" : préférence non-bloquante (phase 2)
 */
export type UnavailabilityType = 'fixed' | 'punctual'

export interface Unavailability {
  id: string
  employeeId: string
  type: UnavailabilityType
  dayOfWeek: number | null // 0=lundi..6=dimanche (pour "fixed")
  specificDate: string | null // ISO date (pour "punctual")
  label: string // Description libre (ex: "Cours du soir")
}

/**
 * Horaires fixes pour les managers.
 * Un manager a un emploi du temps fixe qui ne change pas
 * (sauf contrainte ponctuelle explicite).
 */
export interface ManagerFixedSchedule {
  id: string
  employeeId: string
  dayOfWeek: number // 0=lundi..6=dimanche
  shiftTemplateId: string | null // null = OFF ce jour
  startTime: number | null // override si différent du template
  endTime: number | null // override si différent du template
}

/**
 * Disponibilité conditionnelle (ex: "mer≥18h" = mercredi, uniquement créneau SOIR)
 * Encodée comme : jour + créneau(x) autorisé(s)
 */
export interface ConditionalAvailability {
  id: string
  employeeId: string
  dayOfWeek: number // 0=lundi..6=dimanche
  allowedShiftCodes: string[] // ex: ["SOIR"] pour "≥18h"
  maxHours: number | null // ex: 6 pour "sam≤6h"
}
