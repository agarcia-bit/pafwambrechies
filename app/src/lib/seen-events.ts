import { useState } from 'react';

import { useMember } from '@/lib/session';

// Events the member marked as seen, kept on this phone only: they leave the news
// feed but stay in the Agenda. Per member, so two accounts sharing a phone do not mix.

const MAX_REMEMBERED = 200;
const storageKey = (memberId: string) => `allianceo.seenEvents.${memberId}`;

export function addSeen(list: number[], id: number): number[] {
  return [...new Set([...list, id])].slice(-MAX_REMEMBERED);
}

function read(memberId: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(memberId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export function useSeenEvents() {
  const { profile } = useMember();
  const [seen, setSeen] = useState(() => read(profile.id));

  function markSeen(id: number) {
    const next = addSeen(seen, id);
    setSeen(next);
    try {
      localStorage.setItem(storageKey(profile.id), JSON.stringify(next));
    } catch {
      // Storage unavailable: the event just comes back next time.
    }
  }

  return { seen, markSeen };
}
