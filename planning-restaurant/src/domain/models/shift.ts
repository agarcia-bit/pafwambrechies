/**
 * Créneau horaire autorisé — liste fermée configurable par tenant.
 * Les heures sont en format décimal : 9,5 = 9h30, 24,0 = minuit.
 * Les heures effectives (effectiveHours) sont figées, ne jamais recalculer.
 */
export type ShiftCategory =
  | 'ouverture'
  | 'midi'
  | 'midi_long'
  | 'journee'
  | 'fermeture'
  | 'soir'
  | 'renfort'

export type DayApplicability = 'tue_sat' | 'sat_only' | 'sunday'

export interface ShiftTemplate {
  id: string
  tenantId: string
  code: string
  label: string
  category: ShiftCategory
  startTime: number
  endTime: number
  effectiveHours: number
  meals: number
  baskets: number
  applicability: DayApplicability
  sortOrder: number
  department: 'salle' | 'cuisine'
}

/** Créneaux par défaut HCR (convention Hôtels-Cafés-Restaurants) */
export const DEFAULT_SHIFTS_HCR: Omit<ShiftTemplate, 'id' | 'tenantId'>[] = [
  // Mardi → Samedi
  {
    code: 'OUV',
    label: 'Ouverture',
    category: 'ouverture',
    startTime: 9.5,
    endTime: 15.0,
    effectiveHours: 5.0,
    meals: 1,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 1,
  },
  {
    code: 'MIDI',
    label: 'Midi',
    category: 'midi',
    startTime: 11.0,
    endTime: 15.0,
    effectiveHours: 4.0,
    meals: 0,
    baskets: 1,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 2,
  },
  {
    code: 'MIDI_LONG',
    label: 'Midi long',
    category: 'midi_long',
    startTime: 11.0,
    endTime: 18.0,
    effectiveHours: 6.0,
    meals: 1,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 3,
  },
  {
    code: 'JOURNEE',
    label: 'Journée',
    category: 'journee',
    startTime: 12.0,
    endTime: 23.0,
    effectiveHours: 10.0,
    meals: 2,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 4,
  },
  {
    code: 'FERM_12',
    label: 'Fermeture 12h',
    category: 'fermeture',
    startTime: 12.0,
    endTime: 24.0,
    effectiveHours: 11.0,
    meals: 2,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 5,
  },
  {
    code: 'FERM_16',
    label: 'Fermeture 16h',
    category: 'fermeture',
    startTime: 16.0,
    endTime: 24.0,
    effectiveHours: 7.0,
    meals: 1,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 6,
  },
  {
    code: 'FERM_17',
    label: 'Fermeture 17h',
    category: 'fermeture',
    startTime: 17.0,
    endTime: 24.0,
    effectiveHours: 7.0,
    meals: 1,
    baskets: 0,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 7,
  },
  {
    code: 'SOIR',
    label: 'Soir',
    category: 'soir',
    startTime: 18.0,
    endTime: 24.0,
    effectiveHours: 6.0,
    meals: 0,
    baskets: 1,
    applicability: 'tue_sat',
    department: 'salle',
    sortOrder: 8,
  },
  // Samedi uniquement
  {
    code: 'RENFORT_10',
    label: 'Renfort 10h',
    category: 'renfort',
    startTime: 10.0,
    endTime: 15.0,
    effectiveHours: 4.0,
    meals: 1,
    baskets: 0,
    applicability: 'sat_only',
    department: 'salle',
    sortOrder: 9,
  },
  // Dimanche
  {
    code: 'D_OUV_930',
    label: 'Ouverture dim 9h30',
    category: 'ouverture',
    startTime: 9.5,
    endTime: 15.0,
    effectiveHours: 5.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 10,
  },
  {
    code: 'D_OUV_10',
    label: 'Ouverture dim 10h',
    category: 'ouverture',
    startTime: 10.0,
    endTime: 15.0,
    effectiveHours: 4.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 11,
  },
  {
    code: 'D_MIDI',
    label: 'Midi dim',
    category: 'midi',
    startTime: 11.0,
    endTime: 15.0,
    effectiveHours: 4.0,
    meals: 0,
    baskets: 1,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 12,
  },
  {
    code: 'D_MIDI_L1',
    label: 'Midi long dim 11h',
    category: 'midi_long',
    startTime: 11.0,
    endTime: 19.0,
    effectiveHours: 7.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 13,
  },
  {
    code: 'D_MIDI_L2',
    label: 'Midi long dim 12h',
    category: 'midi_long',
    startTime: 12.0,
    endTime: 19.0,
    effectiveHours: 7.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 14,
  },
  {
    code: 'D_FERM_11',
    label: 'Fermeture dim 11h',
    category: 'fermeture',
    startTime: 11.0,
    endTime: 21.0,
    effectiveHours: 9.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 15,
  },
  {
    code: 'D_FERM_12',
    label: 'Fermeture dim 12h',
    category: 'fermeture',
    startTime: 12.0,
    endTime: 21.0,
    effectiveHours: 9.0,
    meals: 1,
    baskets: 0,
    applicability: 'sunday',
    department: 'salle',
    sortOrder: 16,
  },
]
