import { ALLIANCEO_COLOR } from '@/lib/config';

export type Scheme = 'light' | 'dark';

export type Palette = {
  /** Association color, adjusted to stay readable on the current background. */
  primary: string;
  /** Text and icons drawn on `primary`. */
  onPrimary: string;
  /** Light tint of `primary` for selected states and icon backgrounds. */
  primarySoft: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  separator: string;
  /** Inactive chips, text fields. */
  fill: string;
  danger: string;
  success: string;
};

// iOS system colors (grouped backgrounds), used on every platform.
const BASE: Record<Scheme, Omit<Palette, 'primary' | 'onPrimary' | 'primarySoft'>> = {
  light: {
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#6C6C70',
    separator: '#D1D1D6',
    fill: '#E9E9EE',
    danger: '#FF3B30',
    success: '#34C759',
  },
  dark: {
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#98989F',
    separator: '#38383A',
    fill: '#2C2C2E',
    danger: '#FF453A',
    success: '#30D158',
  },
};

type RGB = [number, number, number];

function parseHex(color: string): RGB | null {
  const hex = color.trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function toHex(rgb: RGB): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes `amount` (0–1) of `other` into `color`. */
export function mix(color: string, other: string, amount: number): string {
  const a = parseHex(color) ?? [0, 0, 0];
  const b = parseHex(other) ?? [0, 0, 0];
  return toHex(a.map((v, i) => v + (b[i] - v) * amount) as RGB);
}

function luminance(color: string): number {
  const rgb = parseHex(color) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function makePalette(scheme: Scheme, brandColor?: string | null): Palette {
  const base = BASE[scheme];
  let primary = brandColor && parseHex(brandColor) ? toHex(parseHex(brandColor)!) : ALLIANCEO_COLOR;
  // Brand colors are usually chosen for a white page: a navy is unreadable in
  // dark mode and a yellow on white, so move them toward the text color.
  for (let i = 0; i < 12 && contrast(primary, base.card) < 4.5; i++) {
    primary = mix(primary, base.text, 0.12);
  }
  return {
    ...base,
    primary,
    // White labels like iOS, unless the color is too light (3:1 suits the bold button text).
    onPrimary: contrast('#FFFFFF', primary) >= 3 ? '#FFFFFF' : '#000000',
    primarySoft: mix(base.card, primary, scheme === 'dark' ? 0.28 : 0.12),
  };
}

/** Badge colors for a hue, e.g. an actu category. */
export function tint(scheme: Scheme, hue: string): { background: string; color: string } {
  const card = BASE[scheme].card;
  return scheme === 'dark'
    ? { background: mix(card, hue, 0.3), color: mix(hue, '#FFFFFF', 0.45) }
    : { background: mix(card, hue, 0.12), color: mix(hue, '#000000', 0.3) };
}
