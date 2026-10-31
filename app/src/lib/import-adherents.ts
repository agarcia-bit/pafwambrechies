// Reads a list of members pasted from a spreadsheet (Excel, Numbers, Google Sheets, a CSV file):
// one member per line, with a first name, a last name (or both in one column), an e-mail and,
// optionally, the date until which their dues are paid. Columns are found by their header when there
// is one (other columns, like a birth date or a phone, are left out), otherwise by their content: the
// one with "@" is the e-mail, recent or future dates are the dues, capitals are the family name.

export type ImportRow = { prenom: string; nom: string; email: string; valide_jusqu: string };
export type ImportLineError = { line: number; text: string; reason: string };
export type ParsedImport = { rows: ImportRow[]; errors: ImportLineError[] };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The separator the spreadsheet used: tab (copy-paste), semicolon (French CSV) or comma. */
function detectSeparator(text: string): string {
  const first = text.split('\n').find((line) => line.trim()) ?? '';
  const counts: [string, number][] = [
    ['\t', first.split('\t').length],
    [';', first.split(';').length],
    [',', first.split(',').length],
  ];
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** One line cut into cells, with "quoted, cells" kept whole. */
function splitLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === separator && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  cells.push(cell.trim());
  return cells;
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

type Field = 'prenom' | 'nom' | 'email' | 'valide_jusqu' | 'complet';

/** What a header announces; 'ignore' for a known column that is none of ours (birth date, phone…). */
function fieldOfHeader(header: string): Field | 'ignore' | null {
  const h = plain(header).replace(/[’']/g, ' ');
  if (!h) return null;
  if (/mail|courriel/.test(h)) return 'email';
  // A dues date, but not a birth, membership start or registration date.
  if (/naiss|adhesion|inscri|debut|creat|telephone|portable|mobile|adresse|ville|code postal/.test(h)) return 'ignore';
  if (/cotisation|jusqu|echeance|expir|renouvel|fin de|date de fin|valable|valid(e|ite) (jusqu|au)/.test(h)) return 'valide_jusqu';
  // One column with the whole name ("Nom et prénom", "Prénom Nom", "Adhérent", "Nom complet"…).
  if (/(nom.*prenom|prenom.*nom|nom complet|adherent|membre|identite|personne)/.test(h)) return 'complet';
  if (/prenom|first/.test(h)) return 'prenom';
  if (/^nom|last|famille|surname|name/.test(h)) return 'nom';
  return 'ignore';
}

/** "14/09/2026", "14-09-26" or "2026-09-14" as "2026-09-14", or null when it is not a date. */
export function parseDate(text: string): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const isDate = (cell: string) => parseDate(cell) !== null;

/** The e-mail address in a cell, also when written "Marie Dupont <marie@x.fr>" or "mailto:…". */
function emailIn(cell: string): string {
  const found = cell.match(/[^@\s<>"'(),;:]+@[^@\s<>"'(),;:]+\.[^@\s<>"'(),;:]+/);
  return found ? found[0].toLowerCase() : '';
}

/** A name written in capitals, the usual way of writing the family name ("DUPONT"). */
const isCapitals = (text: string) => /\p{L}{2}/u.test(text) && text === text.toUpperCase();

/** "Marie Dupont", "DUPONT Marie" or "Dupont, Marie" cut into first and last name. */
function splitFullName(full: string): { prenom: string; nom: string } {
  const text = full.trim().replace(/\s+/g, ' ');
  if (text.includes(',')) {
    const [nom, prenom] = text.split(',').map((t) => t.trim());
    return { prenom, nom };
  }
  const words = text.split(' ');
  if (words.length < 2) return { prenom: '', nom: text };
  // Words in capitals are the family name, wherever they are.
  const caps = words.filter(isCapitals);
  if (caps.length && caps.length < words.length) {
    return { nom: caps.join(' '), prenom: words.filter((w) => !isCapitals(w)).join(' ') };
  }
  return { prenom: words[0], nom: words.slice(1).join(' ') };
}

/** A column of dues dates: dates that are recent or to come (a birth date is decades old). */
function looksLikeDues(dates: string[]): boolean {
  if (!dates.length) return false;
  const sorted = [...dates].sort();
  const median = sorted[Math.floor(sorted.length / 2)];
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86400000).toISOString().slice(0, 10);
  return median >= twoYearsAgo;
}

/** Capitalizes a first or last name written in capitals ("DUPONT" becomes "Dupont"). */
function tidyName(name: string): string {
  const text = name.trim();
  if (text.length < 2 || text !== text.toUpperCase() || text === text.toLowerCase()) return text;
  return text.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

export function parseImport(input: string): ParsedImport {
  const lines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter((l) => l.text.trim());
  if (!lines.length) return { rows: [], errors: [] };

  const separator = detectSeparator(input);
  const table = lines.map((l) => ({ ...l, cells: splitLine(l.text, separator) }));

  // The header is the line just above the first one with an e-mail; anything above it (a title
  // like "Liste des adhérents 2026") is skipped. No line above: no header.
  const firstData = table.findIndex((l) => l.cells.some((c) => emailIn(c)));
  const header = firstData > 0 ? table[firstData - 1].cells : null;
  const body = firstData >= 0 ? table.slice(firstData) : table;
  const width = Math.max(...body.map((l) => l.cells.length), header?.length ?? 0);
  const column = (i: number) => body.map((l) => (l.cells[i] ?? '').trim()).filter(Boolean);

  const columns: Partial<Record<Field, number>> = {};
  const ignored = new Set<number>();
  header?.forEach((h, i) => {
    const field = fieldOfHeader(h);
    if (field === 'ignore') ignored.add(i);
    else if (field && columns[field] === undefined) columns[field] = i;
  });
  // A "Cotisation" column that holds no date at all ("Oui", "Payée", an amount) is not the end date.
  if (columns.valide_jusqu !== undefined && !column(columns.valide_jusqu).some(isDate)) {
    ignored.add(columns.valide_jusqu);
    delete columns.valide_jusqu;
  }
  // The e-mail column: the one whose cells most often hold an e-mail.
  if (columns.email === undefined) {
    let bestCount = 0;
    for (let i = 0; i < width; i++) {
      const count = column(i).filter((c) => emailIn(c)).length;
      if (count > bestCount) [columns.email, bestCount] = [i, count];
    }
  }
  // Without a header only: a column of dates is the dues, if they are recent or to come.
  if (!header && columns.valide_jusqu === undefined) {
    for (let i = 0; i < width; i++) {
      if (i === columns.email) continue;
      const cells = column(i);
      if (cells.length && cells.every(isDate) && looksLikeDues(cells.map((c) => parseDate(c)!))) {
        columns.valide_jusqu = i;
        break;
      }
    }
  }
  // Names: the remaining text columns (not numbers, dates or phone numbers), in the sheet's order.
  const taken = new Set([...Object.values(columns), ...ignored]);
  const textual = (i: number) => {
    const cells = column(i);
    return cells.length > 0 && cells.some((c) => /\p{L}/u.test(c)) && !cells.every((c) => isDate(c) || /^[\d\s.+()/-]+$/.test(c));
  };
  const free = Array.from({ length: width }, (_, i) => i).filter((i) => !taken.has(i) && textual(i));
  if (columns.complet === undefined && columns.prenom === undefined && columns.nom === undefined) {
    if (free.length === 1) columns.complet = free[0];
    else {
      // Without a header, the column written in capitals is the family name ("DUPONT").
      const capitals = (i: number) => column(i).filter(isCapitals).length > column(i).length / 2;
      const [a, b] = free;
      if (a !== undefined && b !== undefined && capitals(a) && !capitals(b)) [columns.nom, columns.prenom] = [a, b];
      else [columns.prenom, columns.nom] = [a, b];
    }
  } else if (columns.complet === undefined) {
    if (columns.prenom === undefined) columns.prenom = free.find((i) => i !== columns.nom);
    else if (columns.nom === undefined) columns.nom = free.find((i) => i !== columns.prenom);
  }

  const rows: ImportRow[] = [];
  const errors: ImportLineError[] = [];
  const seen = new Set<string>();
  const cell = (cells: string[], field: Field) => (columns[field] === undefined ? '' : (cells[columns[field]!] ?? ''));

  for (const { cells, line, text } of body) {
    const email = emailIn(cell(cells, 'email'));
    if (!EMAIL.test(email)) {
      errors.push({ line, text, reason: cell(cells, 'email').trim() ? 'e-mail invalide' : 'e-mail manquant' });
      continue;
    }
    if (seen.has(email)) {
      errors.push({ line, text, reason: 'e-mail en double' });
      continue;
    }
    const rawDate = cell(cells, 'valide_jusqu').trim();
    const valide_jusqu = rawDate ? parseDate(rawDate) : '';
    if (valide_jusqu === null) {
      errors.push({ line, text, reason: `date illisible (${rawDate})` });
      continue;
    }
    seen.add(email);
    const names =
      columns.complet !== undefined
        ? splitFullName(cell(cells, 'complet'))
        : { prenom: cell(cells, 'prenom'), nom: cell(cells, 'nom') };
    rows.push({ prenom: tidyName(names.prenom), nom: tidyName(names.nom), email, valide_jusqu });
  }
  return { rows, errors };
}
