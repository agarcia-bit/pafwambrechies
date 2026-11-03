// Couleurs de l'association, comme dans l'application (app/src/theme/colors.ts) : la couleur
// principale (boutons, liens, onglet actif) et la couleur du bandeau (en-tête du menu).
// Une couleur trop claire ou trop sombre est ajustée pour rester lisible, en clair et en sombre.

type RGB = [number, number, number];
const DEFAULT = '#0F766E';

function parseHex(color: string | null | undefined): RGB | null {
  const hex = (color ?? '').trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}
const toHex = (rgb: RGB) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
function mix(color: string, other: string, amount: number) {
  const a = parseHex(color)!, b = parseHex(other)!;
  return toHex(a.map((v, i) => v + (b[i] - v) * amount) as RGB);
}
function luminance(color: string) {
  const [r, g, b] = parseHex(color)!.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Fonds des panneaux et couleur du texte de styles.css, en clair et en sombre.
const BASE = { light: { panel: '#ffffff', text: '#0f172a' }, dark: { panel: '#141821', text: '#e8ecf2' } };

function palette(dark: boolean, primaryColor?: string | null, bannerColor?: string | null) {
  const base = dark ? BASE.dark : BASE.light;
  let brand = parseHex(primaryColor) ? toHex(parseHex(primaryColor)!) : DEFAULT;
  for (let i = 0; i < 12 && contrast(brand, base.panel) < 4.5; i++) brand = mix(brand, base.text, 0.12);
  const source = parseHex(bannerColor) ? bannerColor! : parseHex(primaryColor) ? primaryColor! : DEFAULT;
  let banner = toHex(parseHex(source)!);
  for (let i = 0; i < 20 && contrast(banner, '#ffffff') < 4.5; i++) banner = mix(banner, '#000000', 0.08);
  if (dark) banner = mix(banner, '#000000', 0.3);
  return {
    '--brand': brand,
    '--brand-ink': contrast('#ffffff', brand) >= 3 ? '#ffffff' : '#000000',
    '--brand-soft': mix(base.panel, brand, dark ? 0.22 : 0.1),
    '--brand-line': mix(base.panel, brand, dark ? 0.45 : 0.4),
    '--banner': banner,
  };
}

let current: { primary?: string | null; banner?: string | null } = {};
const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
  const vars = palette(media.matches, current.primary, current.banner);
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--banner']);
}
media.addEventListener('change', apply);

/** Applique les couleurs de l'association à tout l'espace bureau. */
export function applyBranding(primary?: string | null, banner?: string | null) {
  current = { primary, banner };
  apply();
}
