import { describe, expect, it, vi } from 'vitest';

import { estRecente, quandEstCe } from './useRelance';

// Le client Supabase n'est pas créé pour ces règles de dates.
vi.mock('../lib', () => ({ supabase: {}, toast: () => {} }));

describe('relance : quand et à quel rythme', () => {
  const maintenant = new Date('2026-11-23T17:00:00Z'); // 18 h à Paris

  it('dit quand est partie la dernière relance', () => {
    expect(quandEstCe('2026-11-23T08:05:00Z', maintenant)).toBe('aujourd’hui à 9 h 05');
    expect(quandEstCe('2026-11-22T17:00:00Z', maintenant)).toBe('hier à 18 h');
    expect(quandEstCe('2026-11-03T17:00:00Z', maintenant)).toBe('le 3 novembre à 18 h');
  });

  it('prévient seulement si la dernière relance a moins de 24 h', () => {
    const relance = (iso: string) => ({ created_at: iso, nb_notifications: 3, nb_emails: 1 });
    expect(estRecente(relance('2026-11-23T08:00:00Z'), maintenant.getTime())).toBe(true);
    expect(estRecente(relance('2026-11-22T16:00:00Z'), maintenant.getTime())).toBe(false);
    expect(estRecente(null, maintenant.getTime())).toBe(false);
  });
});
