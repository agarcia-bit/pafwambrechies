import { useSyncExternalStore } from 'react';

import { useMember } from '@/lib/session';

// News the member has read (opened, or marked from the feed), kept on this phone only, per member,
// like the events marked as seen. Read news shrink to a single line in the feed. One shared store,
// so opening a post updates its card in the feed at once.

const MAX_REMEMBERED = 500;
const storageKey = (memberId: string) => `allianceo.readActus.${memberId}`;

let memberId: string | null = null;
let ids = new Set<number>();
const listeners = new Set<() => void>();

function load(id: string) {
  if (memberId === id) return;
  memberId = id;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(id)) ?? '[]');
    ids = new Set(Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []);
  } catch {
    ids = new Set();
  }
}

function save(next: Set<number>) {
  ids = next;
  try {
    if (memberId) localStorage.setItem(storageKey(memberId), JSON.stringify([...next].slice(-MAX_REMEMBERED)));
  } catch {
    // Storage unavailable: the news simply show as unread next time.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReadActus() {
  const { profile } = useMember();
  load(profile.id);
  const read = useSyncExternalStore(subscribe, () => ids);
  return {
    isRead: (id: number) => read.has(id),
    markRead: (...list: number[]) => {
      if (list.every((id) => ids.has(id))) return;
      save(new Set([...ids, ...list]));
    },
    markUnread: (id: number) => {
      if (!ids.has(id)) return;
      const next = new Set(ids);
      next.delete(id);
      save(next);
    },
  };
}
