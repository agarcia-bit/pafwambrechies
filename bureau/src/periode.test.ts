import { describe, expect, it, vi } from 'vitest';

// Le client Supabase n'a pas à exister pour tester les dates ; « aujourd'hui » est fixé.
vi.mock('./lib', () => ({ today: () => '2026-06-13', formatDay: (iso: string) => iso }));

import { compterPresentsParJour, dernierJour, estPasse, joursDeLEvenement, resumerJoursChoisis } from './periode';

describe('dernierJour et estPasse', () => {
  it('garde un événement sur plusieurs jours à venir jusqu’à son dernier jour', () => {
    const ev = { date: '2026-06-12', date_fin: '2026-06-14' };
    expect(dernierJour(ev)).toBe('2026-06-14');
    expect(estPasse(ev)).toBe(false);
  });
  it('range comme passé un événement d’un jour d’hier', () => {
    expect(estPasse({ date: '2026-06-12', date_fin: null })).toBe(true);
  });
});

describe('joursDeLEvenement', () => {
  it('liste chaque jour, y compris à cheval sur deux mois', () => {
    expect(joursDeLEvenement({ date: '2026-05-30', date_fin: '2026-06-02' })).toEqual([
      '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
    ]);
  });
});

describe('resumerJoursChoisis et compterPresentsParJour', () => {
  it('dit « toute la durée » sans jour précisé', () => {
    expect(resumerJoursChoisis(null)).toBe('toute la durée');
  });
  it('compte un présent « toute la durée » chaque jour, les autres seulement leurs jours', () => {
    const reponses = [
      { reponse: 'present', jours: null },
      { reponse: 'present', jours: ['2026-06-13'] },
      { reponse: 'absent', jours: null },
    ];
    expect(compterPresentsParJour(['2026-06-12', '2026-06-13'], reponses)).toEqual([
      { jour: '2026-06-12', presents: 1 },
      { jour: '2026-06-13', presents: 2 },
    ]);
  });
});
