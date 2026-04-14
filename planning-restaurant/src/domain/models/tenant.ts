export interface TenantRules {
  // Règles légales / contrats
  minRestHours: number          // repos min entre 2 jours travaillés (h)
  maxWorkingDays: number        // max jours travaillés / sem
  fulltimeThreshold: number     // seuil temps plein (h/sem)
  // Salle
  minClosingWeekday: number     // min personnes fermeture Mar-Mer
  minClosingWeekend: number     // min personnes fermeture Jeu-Dim
  weekendStartDay: number       // jour (0-6) où commence le "weekend" (défaut 3=jeu)
  // Cuisine
  minKitchenMidi: number        // min cuisiniers au midi
  kitchenPrepDay: number | null // jour de préparation (0-6) ou null
  kitchenPrepTeam: string[]     // UUIDs des employés d'équipe prep
  kitchenClosedSundayEvening: boolean
  // Productivité (seuils indicateurs)
  productivityLowerThreshold: number // sous ce seuil: orange "délester"
  productivityUpperThreshold: number // au-dessus: rouge "renfort"
}

export interface Tenant {
  id: string
  name: string
  address: string | null
  logoUrl: string | null
  openingTime: number // decimal, e.g. 9.5 = 9h30
  closingTimeWeek: number // e.g. 24.0 = minuit
  closingTimeSunday: number // e.g. 21.0
  closedDays: readonly number[] // 0=lundi, 1=mardi... (default: [0] = lundi)
  productivityMin: number // default 80
  productivityMax: number // default 100
  productivityTarget: number // default 95
  rules: TenantRules
  createdAt: string
}

export const DEFAULT_TENANT_RULES: TenantRules = {
  minRestHours: 11,
  maxWorkingDays: 5,
  fulltimeThreshold: 35,
  minClosingWeekday: 4,
  minClosingWeekend: 6,
  weekendStartDay: 3,
  minKitchenMidi: 2,
  kitchenPrepDay: null,
  kitchenPrepTeam: [],
  kitchenClosedSundayEvening: true,
  productivityLowerThreshold: 85,
  productivityUpperThreshold: 110,
}

export const DEFAULT_TENANT_CONFIG = {
  openingTime: 9.5,
  closingTimeWeek: 24.0,
  closingTimeSunday: 21.0,
  closedDays: [0], // Lundi
  productivityMin: 80,
  productivityMax: 150,
  productivityTarget: 95,
  rules: DEFAULT_TENANT_RULES,
} as const

/** Merge partial rules from DB with defaults. */
export function mergeRules(partial: Partial<TenantRules> | null | undefined): TenantRules {
  return { ...DEFAULT_TENANT_RULES, ...(partial ?? {}) }
}
