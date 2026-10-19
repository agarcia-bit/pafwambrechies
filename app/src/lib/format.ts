const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// "YYYY-MM-DD" columns are calendar days: parse them as local dates, not UTC.
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local calendar day of a Date as "YYYY-MM-DD". */
export function isoDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function todayISO(): string {
  return isoDay(new Date());
}

/** "HH:MM" of a Date. */
export function hourMinute(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 25 septembre 2026 */
export function formatDay(iso: string): string {
  const date = parseDay(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "25 sept." (with the year when it is not the current one) */
export function formatDayShort(iso: string): string {
  const date = parseDay(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** Vendredi 25 septembre 2026 */
export function formatDayLong(iso: string): string {
  const day = WEEKDAYS[parseDay(iso).getDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatDay(iso)}`;
}

/** { day: 25, month: "sept." } for date blocks */
export function dayParts(iso: string): { day: number; month: string } {
  const date = parseDay(iso);
  return { day: date.getDate(), month: MONTHS_SHORT[date.getMonth()] };
}

/** "Septembre 2026" for section headers */
export function monthLabel(iso: string): string {
  const date = parseDay(iso);
  const month = MONTHS[date.getMonth()];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

/** "À l'instant", "Il y a 5 min", "Hier", "12 sept." for timestamps */
export function formatRelative(timestamp: string): string {
  const date = new Date(timestamp);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (minutes < 24 * 60) return `Il y a ${Math.round(minutes / 60)} h`;
  if (minutes < 48 * 60) return 'Hier';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

export function fullName(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(' ');
}

export function initial(name: string | null | undefined): string {
  return (name?.trim().charAt(0) || '?').toUpperCase();
}

/** "Jusqu’au 25 septembre 2026" for an offer's end date. */
export function offerValidity(expiration: string | null): string {
  return expiration ? `Jusqu’au ${formatDay(expiration)}` : 'Sans date limite';
}

/** Lowercase without accents, for search ("café" matches "cafe"). */
export function searchable(text: string): string {
  let plain = text;
  try {
    plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // Without Unicode normalization, accents simply stay significant.
  }
  return plain.toLowerCase().trim();
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}
