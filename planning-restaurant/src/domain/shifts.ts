import type { ShiftDefinition } from './types';

// ── Salle (front-of-house) shifts ───────────────────────────────

export const SALLE_SHIFTS: ShiftDefinition[] = [
  {
    id: 'salle-midi-court',
    label: 'Midi court (11h30–14h30)',
    startHour: 11, startMinute: 30,
    endHour: 14, endMinute: 30,
    role: 'salle', service: 'midi',
    durationHours: 3,
  },
  {
    id: 'salle-midi-standard',
    label: 'Midi (11h–15h)',
    startHour: 11, startMinute: 0,
    endHour: 15, endMinute: 0,
    role: 'salle', service: 'midi',
    durationHours: 4,
  },
  {
    id: 'salle-midi-long',
    label: 'Midi long (10h–15h30)',
    startHour: 10, startMinute: 0,
    endHour: 15, endMinute: 30,
    role: 'salle', service: 'midi',
    durationHours: 5.5,
  },
  {
    id: 'salle-soir-court',
    label: 'Soir court (18h30–22h30)',
    startHour: 18, startMinute: 30,
    endHour: 22, endMinute: 30,
    role: 'salle', service: 'soir',
    durationHours: 4,
  },
  {
    id: 'salle-soir-standard',
    label: 'Soir (18h–23h)',
    startHour: 18, startMinute: 0,
    endHour: 23, endMinute: 0,
    role: 'salle', service: 'soir',
    durationHours: 5,
  },
  {
    id: 'salle-soir-long',
    label: 'Soir long (18h–00h)',
    startHour: 18, startMinute: 0,
    endHour: 0, endMinute: 0,
    role: 'salle', service: 'soir',
    durationHours: 6,
  },
];

// ── Cuisine (kitchen) shifts ────────────────────────────────────

export const CUISINE_SHIFTS: ShiftDefinition[] = [
  {
    id: 'cuisine-midi',
    label: 'Cuisine midi (9h–15h)',
    startHour: 9, startMinute: 0,
    endHour: 15, endMinute: 0,
    role: 'cuisine', service: 'midi',
    durationHours: 6,
    // Sunday: same end time
  },
  {
    id: 'cuisine-soir-long',
    label: 'Cuisine soir (18h–23h)',
    startHour: 18, startMinute: 0,
    endHour: 23, endMinute: 0,
    role: 'cuisine', service: 'soir',
    durationHours: 5,
    sundayOverride: {
      endHour: 17, endMinute: 0,
      durationHours: -1, // computed below: 15h→17h on Sunday
    },
  },
  {
    id: 'cuisine-soir-court',
    label: 'Cuisine soir court (19h–23h)',
    startHour: 19, startMinute: 0,
    endHour: 23, endMinute: 0,
    role: 'cuisine', service: 'soir',
    durationHours: 4,
    sundayOverride: {
      endHour: 17, endMinute: 0,
      durationHours: -1, // computed below
    },
  },
];

// Fix Sunday durations for kitchen evening shifts:
// On Sunday the kitchen evening service starts right after midi (15h) and ends at 17h
CUISINE_SHIFTS.forEach((s) => {
  if (s.sundayOverride && s.sundayOverride.durationHours === -1) {
    // Sunday evening kitchen: 15h → 17h = 2h
    s.sundayOverride.durationHours = 2;
  }
});

// ── All shifts combined ─────────────────────────────────────────

export const ALL_SHIFTS: ShiftDefinition[] = [...SALLE_SHIFTS, ...CUISINE_SHIFTS];

// ── Helpers ─────────────────────────────────────────────────────

export function getShiftById(id: string): ShiftDefinition | undefined {
  return ALL_SHIFTS.find((s) => s.id === id);
}

export function getShiftHours(shift: ShiftDefinition, day: number): number {
  if (day === 6 && shift.sundayOverride) {
    return shift.sundayOverride.durationHours;
  }
  return shift.durationHours;
}

export function getShiftsForRole(
  role: 'salle' | 'cuisine',
  service?: 'midi' | 'soir',
): ShiftDefinition[] {
  const pool = role === 'salle' ? SALLE_SHIFTS : CUISINE_SHIFTS;
  if (service) return pool.filter((s) => s.service === service);
  return pool;
}

export function formatShiftTime(shift: ShiftDefinition, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${pad(shift.startHour)}h${shift.startMinute ? pad(shift.startMinute) : ''}`;
  const endH = day === 6 && shift.sundayOverride ? shift.sundayOverride.endHour : shift.endHour;
  const endM = day === 6 && shift.sundayOverride ? shift.sundayOverride.endMinute : shift.endMinute;
  const end = `${pad(endH)}h${endM ? pad(endM) : ''}`;
  return `${start}–${end}`;
}
