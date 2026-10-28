// Reads a list of members pasted from a spreadsheet (Excel, Numbers, Google Sheets, a CSV file):
// one member per line, with a first name, a last name, an e-mail and, optionally, the date until
// which their dues are paid. Columns are found by their header when there is one, otherwise by
// their content (the one with "@" is the e-mail, a date is the dues), otherwise by order.

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

type Field = 'prenom' | 'nom' | 'email' | 'valide_jusqu';

function fieldOfHeader(header: string): Field | null {
  const h = plain(header);
  if (/mail|courriel/.test(h)) return 'email';
  if (/prenom|first/.test(h)) return 'prenom';
  if (/cotisation|valid|jusqu|fin|echeance|expir|renouvel/.test(h)) return 'valide_jusqu';
  if (/^nom|last|famille|surname/.test(h)) return 'nom';
  return null;
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

  // A first line without any e-mail is a header.
  const header = table[0].cells.some((c) => EMAIL.test(c)) ? null : table[0].cells;
  const body = header ? table.slice(1) : table;

  const columns: Partial<Record<Field, number>> = {};
  header?.forEach((h, i) => {
    const field = fieldOfHeader(h);
    if (field && columns[field] === undefined) columns[field] = i;
  });
  // The e-mail column: the one whose cells most often look like an e-mail.
  if (columns.email === undefined) {
    const width = Math.max(...body.map((l) => l.cells.length));
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < width; i++) {
      const count = body.filter((l) => EMAIL.test(l.cells[i] ?? '')).length;
      if (count > bestCount) [best, bestCount] = [i, count];
    }
    if (best >= 0) columns.email = best;
  }
  if (columns.valide_jusqu === undefined) {
    const width = Math.max(...body.map((l) => l.cells.length));
    for (let i = 0; i < width; i++) {
      if (i !== columns.email && body.some((l) => isDate(l.cells[i] ?? ''))) {
        columns.valide_jusqu = i;
        break;
      }
    }
  }
  // Names: the remaining columns, first name then last name, in the order of the sheet.
  const taken = new Set(Object.values(columns));
  const free = Array.from({ length: Math.max(...table.map((l) => l.cells.length)) }, (_, i) => i).filter((i) => !taken.has(i));
  if (columns.prenom === undefined && columns.nom === undefined) {
    [columns.prenom, columns.nom] = free;
  } else if (columns.prenom === undefined) {
    columns.prenom = free.find((i) => i !== columns.nom);
  } else if (columns.nom === undefined) {
    columns.nom = free.find((i) => i !== columns.prenom);
  }

  const rows: ImportRow[] = [];
  const errors: ImportLineError[] = [];
  const seen = new Set<string>();
  const cell = (cells: string[], field: Field) => (columns[field] === undefined ? '' : (cells[columns[field]!] ?? ''));

  for (const { cells, line, text } of body) {
    const email = cell(cells, 'email').trim().toLowerCase();
    if (!EMAIL.test(email)) {
      errors.push({ line, text, reason: email ? 'e-mail invalide' : 'e-mail manquant' });
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
    rows.push({
      prenom: tidyName(cell(cells, 'prenom')),
      nom: tidyName(cell(cells, 'nom')),
      email,
      valide_jusqu,
    });
  }
  return { rows, errors };
}
