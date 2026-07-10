export interface ServiceSlot {
  key: string        // identifiant stable (ex: 'midi', 'soir_1')
  label: string      // libellé affiché (ex: 'Midi 11-15')
  startTime: number  // heure décimale de début (ex: 11)
  endTime: number    // heure décimale de fin (ex: 15)
}

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
  // Affichage du planning
  planningShowRoleBadges: boolean    // afficher les pastilles rôle dans le décompte
  planningServiceSlots: ServiceSlot[] // créneaux personnalisés du décompte
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

export const DEFAULT_SERVICE_SLOTS: ServiceSlot[] = [
  { key: 'ouverture', label: 'Ouv. 9h30', startTime: 9.5, endTime: 10 },
  { key: 'matin', label: 'Matin 9-11', startTime: 9, endTime: 11 },
  { key: 'midi', label: 'Midi 11-15', startTime: 11, endTime: 15 },
  { key: 'aprem', label: 'A-midi 15-18', startTime: 15, endTime: 18 },
  { key: 'soir', label: 'Soir 18-ferm.', startTime: 18, endTime: 23 },
  { key: 'fermeture', label: 'Fermeture', startTime: 23, endTime: 24 },
]

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
  planningShowRoleBadges: true,
  planningServiceSlots: DEFAULT_SERVICE_SLOTS,
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
