/**
 * Règles de productivité.
 *
 * Productivité = CA_cible / Heures_planifiées
 * Doit être entre productivityMin et productivityMax (défaut : 80-100, cible 95)
 */

export interface ProductivityCheck {
  date: string
  dayOfWeek: number
  forecastedRevenue: number
  plannedHours: number
  productivity: number
  status: 'ok' | 'over_staffed' | 'under_staffed'
  isDelestage: boolean
}

/**
 * Calcule le budget heures pour un jour donné.
 * Budget = CA_cible / productivité_cible
 */
export function calculateHoursBudget(
  forecastedRevenue: number,
  productivityTarget: number,
): number {
  if (productivityTarget === 0) return 0
  return forecastedRevenue / productivityTarget
}

/**
 * Calcule le budget heures à allouer (hors managers).
 */
export function calculateAllocatableHours(
  forecastedRevenue: number,
  productivityTarget: number,
  managerHours: number,
): number {
  const totalBudget = calculateHoursBudget(forecastedRevenue, productivityTarget)
  return Math.max(0, totalBudget - managerHours)
}

/**
 * Vérifie la productivité d'un jour.
 */
export function checkProductivity(
  forecastedRevenue: number,
  plannedHours: number,
  minProductivity: number,
  maxProductivity: number,
): ProductivityCheck['status'] {
  if (plannedHours === 0) return 'under_staffed'
  const productivity = forecastedRevenue / plannedHours
  if (productivity < minProductivity) return 'over_staffed'
  if (productivity > maxProductivity) return 'under_staffed'
  return 'ok'
}

/**
 * Ordre de délestage — jours à sacrifier en premier
 * quand il n'y a pas assez d'heures disponibles.
 */
export const DELESTAGE_ORDER: { dayOfWeek: number; period: string }[] = [
  { dayOfWeek: 1, period: 'midi' }, // Mardi MIDI — sacrifié en premier
  { dayOfWeek: 3, period: 'midi' }, // Jeudi MIDI
  { dayOfWeek: 4, period: 'midi' }, // Vendredi MIDI — sacrifié en dernier
]

/** Jours jamais sous-staffés */
export const NEVER_UNDERSTAFF: number[] = [
  2, // Mercredi
  // Vendredi SOIR (géré séparément)
  5, // Samedi
  6, // Dimanche
]

/**
 * Détermine si le délestage est nécessaire.
 * Condition : total heures nécessaires > total heures disponibles.
 */
export function isDelestageRequired(
  totalBudgetHours: number,
  totalAvailableHours: number,
): boolean {
  return totalBudgetHours > totalAvailableHours
}
