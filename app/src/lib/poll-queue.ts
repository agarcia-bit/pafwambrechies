import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  cancelReminder,
  POSTPONE_MS,
  readPostponements,
  scheduleReminder,
  storageKey,
  type Postponements,
} from '@/lib/poll-reminders';
import { useMember } from '@/lib/session';
import { usePendingSondages, type MemberSondage } from '@/lib/sondages';

// Which unanswered polls cover the app, and which wait.
//
//   * a required poll (obligatoire) covers the app until it is answered;
//   * any other poll can be postponed ONCE: it then waits as a card in the feed,
//     a reminder notification is scheduled on the phone 3 days later (it fires even
//     if the app stays closed), and when those 3 days are over the poll covers the
//     app again, this time without "later";
// The same rules apply to everyone, admins included: an admin who launches a required poll
// must answer it too. Postponements live on the phone, per member (like "seen" events).

export type GatedPoll = { poll: MemberSondage; canPostpone: boolean };

/** Pure: sorts the unanswered polls into those covering the app and those waiting. */
export function splitPolls(
  polls: MemberSondage[],
  postponed: Postponements,
  now: number
): { gated: GatedPoll[]; waiting: MemberSondage[] } {
  const gated: GatedPoll[] = [];
  const waiting: MemberSondage[] = [];
  for (const poll of polls) {
    const entry = postponed[String(poll.id)];
    // Too close to the deadline for "later" (it would end before the 3-day reminder).
    const tooLate = !!poll.date_limite && Date.parse(`${poll.date_limite}T23:59:59`) - now <= POSTPONE_MS;
    if (!entry) gated.push({ poll, canPostpone: !poll.obligatoire && !tooLate });
    else if (now - entry.at < POSTPONE_MS) waiting.push(poll);
    else gated.push({ poll, canPostpone: false });
  }
  return { gated, waiting };
}

// ── Storage and shared state ─────────────────────────────────────────────────

type State = { memberId: string | null; postponed: Postponements; requestedId: number | null };
let state: State = { memberId: null, postponed: {}, requestedId: null };
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** The shared state for this member, loaded from the phone the first time (and after a change of member). */
function stateFor(memberId: string): State {
  if (state.memberId !== memberId) {
    state = { memberId, postponed: readPostponements(memberId), requestedId: null };
  }
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function save(memberId: string, postponed: Postponements) {
  try {
    localStorage.setItem(storageKey(memberId), JSON.stringify(postponed));
  } catch {
    // Storage unavailable: the postponement only lasts until the app closes.
  }
  update({ postponed });
}

/** Re-renders every minute, so a postponement that ends covers the app again by itself. */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The unanswered polls of the member, split into "covers the app" and "waits", with the actions. */
export function usePollQueue() {
  const { profile } = useMember();
  const polls = usePendingSondages();
  const shared = useSyncExternalStore(subscribe, () => stateFor(profile.id));
  const now = useNow();
  const { gated, waiting } = splitPolls(polls.data ?? [], shared.postponed, now);

  return {
    gated,
    waiting,
    postponedAt: (pollId: number) => shared.postponed[String(pollId)]?.at ?? null,
    requested: (polls.data ?? []).find((p) => p.id === shared.requestedId) ?? null,
    /** The member wants to answer a waiting poll now: it covers the app, with a way back. */
    requestPoll: (pollId: number | null) => update({ requestedId: pollId }),
    /** "Later": allowed once, with a reminder in 3 days (never offered for a required poll). */
    async postpone(poll: MemberSondage) {
      const notificationId = await scheduleReminder(poll);
      save(profile.id, { ...readPostponements(profile.id), [String(poll.id)]: { at: Date.now(), notificationId } });
    },
    /** The poll is answered: its reminder is no longer needed. */
    async settle(pollId: number) {
      const current = readPostponements(profile.id);
      await cancelReminder(current[String(pollId)]?.notificationId ?? null);
      delete current[String(pollId)];
      save(profile.id, current);
      if (state.requestedId === pollId) update({ requestedId: null });
    },
  };
}
