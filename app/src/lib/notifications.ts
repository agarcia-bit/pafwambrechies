import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'allianceo.pushToken';
const DISABLED_KEY = 'allianceo.pushDisabled';
const OFFER_DISMISSED_KEY = 'allianceo.pushOfferDismissed';

// 'unavailable': web, simulator, or no EAS project yet (no push token possible).
export type PushStatus = 'enabled' | 'disabled' | 'denied' | 'unavailable';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function pushAvailable(): boolean {
  return Platform.OS !== 'web' && Device.isDevice && !!projectId();
}

async function registerToken(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Actualités',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const { error } = await supabase.rpc('register_device_token', { p_token: token, p_platform: Platform.OS });
  if (error) throw error;
  localStorage.setItem(TOKEN_KEY, token);
}

/** State for this phone and member, without prompting. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushAvailable()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  if (status !== 'granted' || localStorage.getItem(DISABLED_KEY)) return 'disabled';
  return localStorage.getItem(TOKEN_KEY) ? 'enabled' : 'disabled';
}

/** Asks for permission if needed, then registers this phone for the member's association. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushAvailable()) return 'unavailable';
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';
  localStorage.removeItem(DISABLED_KEY);
  await registerToken();
  return 'enabled';
}

export async function disablePush(): Promise<void> {
  localStorage.setItem(DISABLED_KEY, '1');
  await unregisterToken();
}

/** After sign-in: keeps the token current when the member already allowed notifications. */
export async function syncPush(): Promise<void> {
  if (!pushAvailable() || localStorage.getItem(DISABLED_KEY)) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') await registerToken();
}

/** Before sign-out: the next member using this phone must not get this member's notifications. */
export async function forgetPush(): Promise<void> {
  localStorage.removeItem(DISABLED_KEY);
  await unregisterToken();
}

async function unregisterToken(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  localStorage.removeItem(TOKEN_KEY);
  await supabase.rpc('unregister_device_token', { p_token: token });
}

/** Whether to show the "turn on notifications" card: never asked, never dismissed. */
export async function shouldOfferPush(): Promise<boolean> {
  if (!pushAvailable() || localStorage.getItem(OFFER_DISMISSED_KEY)) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'undetermined';
}

export function dismissPushOffer(): void {
  localStorage.setItem(OFFER_DISMISSED_KEY, '1');
}
