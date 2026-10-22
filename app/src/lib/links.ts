import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { showMessage } from '@/lib/confirm';

// URLs typed by admins ("www.site.fr", "linkedin.com/in/x") often lack a scheme.
export function externalUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`;
}

export function mapsUrl(address: string): string {
  const q = encodeURIComponent(address);
  if (Platform.OS === 'ios') return `https://maps.apple.com/?q=${q}`;
  if (Platform.OS === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function instagramUrl(value: string): string {
  const v = value.trim();
  return /instagram\.com/i.test(v) ? externalUrl(v) : `https://www.instagram.com/${v.replace(/^@/, '')}/`;
}

/** Web pages open in the in-app browser, everything else in the matching app. */
export async function openLink(url: string, { inApp = true } = {}): Promise<void> {
  try {
    if (inApp && /^https?:/i.test(url) && Platform.OS !== 'web') {
      await WebBrowser.openBrowserAsync(url);
    } else {
      await Linking.openURL(url);
    }
  } catch {
    showMessage("Impossible d'ouvrir ce lien.");
  }
}
