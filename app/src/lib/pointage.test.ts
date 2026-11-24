import { describe, expect, it } from 'vitest';

import { estActionPassee, jourLocal, peutPointer, phraseDuPointage, presenceApres, resumeDuPointage, tranchesAPointer } from './pointage';

type Inscrit = { id: number; pole_id: number; debut: string; presence: 'venu' | 'absent' | null };
const inscrit = (id: number, pole_id: number, debut: string, presence: Inscrit['presence'] = null): Inscrit => ({ id, pole_id, debut, presence });
const poles = [
  { id: 2, nom: 'Gaufres', personnes: 2, besoins_par_creneau: {}, ordre: 0 },
  { id: 1, nom: 'Café', personnes: 2, besoins_par_creneau: {}, ordre: 1 },
];

describe('pointage du jour J', () => {
  it('range les inscrits par heure, puis par pôle dans l’ordre du planning', () => {
    const tranches = tranchesAPointer({ poles, inscrits: [inscrit(1, 1, '12:00'), inscrit(2, 1, '10:00'), inscrit(3, 2, '10:00')] }, 120);
    expect(tranches.map((t) => t.libelle)).toEqual(['10 h – 12 h', '12 h – 14 h']);
    expect(tranches[0].inscrits.map((i) => `${i.nomDuPole} ${i.inscrit.id}`)).toEqual(['Gaufres 3', 'Café 2']);
  });

  it('résume le pointage en une phrase', () => {
    const resume = resumeDuPointage([inscrit(1, 1, '10:00', 'venu'), inscrit(2, 1, '10:00', 'absent'), inscrit(3, 1, '10:00')]);
    expect(resume).toEqual({ venus: 1, absents: 1, aPointer: 1 });
    expect(phraseDuPointage(resume)).toBe('1 venu · 1 absent · 1 à pointer');
    expect(phraseDuPointage({ venus: 12, absents: 2, aPointer: 0 })).toBe('Tout est pointé : 12 venus, 2 absents.');
    expect(phraseDuPointage({ venus: 0, absents: 0, aPointer: 5 })).toBe('5 personnes à pointer');
    expect(phraseDuPointage({ venus: 3, absents: 0, aPointer: 1 })).toBe('3 venus · 1 à pointer');
  });

  it('annule le pointage quand on retouche le même bouton', () => {
    expect(presenceApres(null, 'venu')).toBe('venu');
    expect(presenceApres('venu', 'absent')).toBe('absent');
    expect(presenceApres('venu', 'venu')).toBeNull();
  });

  it('sait si l’action est passée et si l’on peut pointer, le jour J compris', () => {
    expect(estActionPassee('2026-11-23', '2026-11-24')).toBe(true);
    expect(estActionPassee('2026-11-24', '2026-11-24')).toBe(false);
    expect(peutPointer('2026-11-24', '2026-11-24')).toBe(true);
    expect(peutPointer('2026-11-25', '2026-11-24')).toBe(false);
    expect(jourLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
