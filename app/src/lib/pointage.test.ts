import { describe, expect, it, vi } from 'vitest';

import { phraseDuPointage, presenceApres, resumeDuPointage, tranchesAPointer } from './pointage';
import type { Inscrit } from './planning';

// vi.mock est remonté avant les imports : le vrai client Supabase n'est jamais créé.
vi.mock('./supabase', () => ({ supabase: {} }));

const inscrit = (id: number, pole_id: number, debut: string, presence: Inscrit['presence'] = null): Inscrit =>
  ({ id, pole_id, debut, membre: null, nom: `Bénévole ${id}`, a_compte: false, presence });
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
  });

  it('annule le pointage quand on retouche le même bouton', () => {
    expect(presenceApres(null, 'venu')).toBe('venu');
    expect(presenceApres('venu', 'absent')).toBe('absent');
    expect(presenceApres('venu', 'venu')).toBeNull();
  });
});
