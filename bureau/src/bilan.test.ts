import { describe, expect, it, vi } from 'vitest';

import { periodesDuBilan, resumeDuBilan, type LigneDuBilan } from './bilan';

vi.mock('./lib', () => ({ supabase: {} }));

const ligne = (cle: string, creneaux: number, absences = 0): LigneDuBilan =>
  ({ cle, nom: cle, a_compte: true, creneaux, actions: creneaux ? 1 : 0, absences, derniere: null });

describe('bilan des bénévoles', () => {
  it('propose l’année en cours, les douze derniers mois et l’année d’avant', () => {
    expect(periodesDuBilan('2026-11-24').map((p) => [p.libelle, p.debut, p.fin])).toEqual([
      ['Année 2026', '2026-01-01', '2026-12-31'],
      ['12 derniers mois', '2025-11-24', '2026-11-24'],
      ['Année 2025', '2025-01-01', '2025-12-31'],
    ]);
  });

  it('recule d’un an sans tomber sur un 29 février qui n’existe pas', () => {
    expect(periodesDuBilan('2028-02-29')[1].debut).toBe('2027-02-28');
  });

  it('ne compte comme bénévole que qui a tenu au moins un créneau', () => {
    expect(resumeDuBilan([ligne('lea', 5), ligne('tom', 2, 1), ligne('max', 0, 2)])).toEqual({ benevoles: 2, creneaux: 7, absences: 3 });
  });
});
