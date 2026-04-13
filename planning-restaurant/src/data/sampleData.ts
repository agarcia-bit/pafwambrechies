import type { Employee, WeekConfig, DayConfig, DayIndex } from '../domain/types';

// ── Sample Employees ────────────────────────────────────────────

const fullWeekMidiSoir = (days: DayIndex[]) => {
  const map: Partial<Record<DayIndex, ('midi' | 'soir')[]>> = {};
  for (const d of days) map[d] = ['midi', 'soir'];
  return map;
};

const midiOnly = (days: DayIndex[]) => {
  const map: Partial<Record<DayIndex, ('midi' | 'soir')[]>> = {};
  for (const d of days) map[d] = ['midi'];
  return map;
};

const soirOnly = (days: DayIndex[]) => {
  const map: Partial<Record<DayIndex, ('midi' | 'soir')[]>> = {};
  for (const d of days) map[d] = ['soir'];
  return map;
};

export const SAMPLE_EMPLOYEES: Employee[] = [
  // ── Salle ──
  {
    id: 'emp-1',
    firstName: 'Marie',
    lastName: 'Dupont',
    role: 'salle',
    contractHours: 35,
    availability: fullWeekMidiSoir([0, 1, 2, 3, 4, 5]),
  },
  {
    id: 'emp-2',
    firstName: 'Lucas',
    lastName: 'Martin',
    role: 'salle',
    contractHours: 35,
    availability: fullWeekMidiSoir([0, 1, 2, 3, 4, 5, 6]),
  },
  {
    id: 'emp-3',
    firstName: 'Julie',
    lastName: 'Bernard',
    role: 'salle',
    contractHours: 24,
    availability: { ...midiOnly([0, 1, 2]), ...fullWeekMidiSoir([4, 5, 6]) },
  },
  {
    id: 'emp-4',
    firstName: 'Thomas',
    lastName: 'Petit',
    role: 'salle',
    contractHours: 20,
    availability: soirOnly([2, 3, 4, 5, 6]),
  },
  {
    id: 'emp-5',
    firstName: 'Emma',
    lastName: 'Leroy',
    role: 'salle',
    contractHours: 30,
    availability: fullWeekMidiSoir([0, 1, 3, 4, 5]),
  },

  // ── Cuisine ──
  {
    id: 'emp-6',
    firstName: 'Antoine',
    lastName: 'Moreau',
    role: 'cuisine',
    contractHours: 39,
    availability: fullWeekMidiSoir([0, 1, 2, 3, 4, 5, 6]),
  },
  {
    id: 'emp-7',
    firstName: 'Sophie',
    lastName: 'Garcia',
    role: 'cuisine',
    contractHours: 35,
    availability: fullWeekMidiSoir([0, 1, 2, 3, 4, 5]),
  },
  {
    id: 'emp-8',
    firstName: 'Hugo',
    lastName: 'Roux',
    role: 'cuisine',
    contractHours: 25,
    availability: { ...midiOnly([0, 1, 2, 3]), ...fullWeekMidiSoir([4, 5, 6]) },
  },
];

// ── Default Week Config ─────────────────────────────────────────

function makeDayConfigs(): DayConfig[] {
  const adjustments: Record<DayIndex, number> = {
    0: -10,   // Lundi – calme
    1: 0,     // Mardi – normal
    2: 0,     // Mercredi – normal
    3: +5,    // Jeudi – léger boost
    4: +15,   // Vendredi – busy
    5: +25,   // Samedi – très busy
    6: +10,   // Dimanche – brunch/midi
  };

  return ([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((day) => ({
    day,
    minStaffMidi: null,
    minStaffSoir: null,
    revenueAdjustmentPct: adjustments[day],
  }));
}

export const SAMPLE_WEEK_CONFIG: WeekConfig = {
  weekStart: '2026-04-13', // Monday
  baseWeeklyRevenue: 28000,
  dayConfigs: makeDayConfigs(),
  defaultMinStaffMidi: 2,
  defaultMinStaffSoir: 3,
};
