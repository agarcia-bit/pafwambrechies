import { useSyncExternalStore } from 'react';

// The guided tour (components/guided-tour.tsx): shown once per member on this phone, the first time
// the app opens on their account, and again on request from "Plus". While it is open, the screens
// that cover the app (poll to answer, event to confirm) wait for it to close.

const storageKey = (memberId: string) => `allianceo.tourDone.${memberId}`;

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function tourDone(memberId: string): boolean {
  try {
    return localStorage.getItem(storageKey(memberId)) === '1';
  } catch {
    return true; // storage unavailable: never force the tour on each launch
  }
}

export function markTourDone(memberId: string) {
  try {
    localStorage.setItem(storageKey(memberId), '1');
  } catch {
    // Nothing to do: at worst the tour comes back once.
  }
}

export function openTour() {
  if (open) return;
  open = true;
  emit();
}

export function closeTour() {
  if (!open) return;
  open = false;
  emit();
}

/** True while the guided tour covers the app. */
export function useTourOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
