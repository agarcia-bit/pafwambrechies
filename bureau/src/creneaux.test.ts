import { describe, expect, it } from 'vitest';

import {
  besoinDuCreneau, bilanDesPlaces, changerLeBesoin, etatDuCreneau, libelleDeLEtat, libelleDeTranche, tranchesDeLaJournee,
} from './creneaux';

const cafe = { id: 1, nom: 'Café', personnes: 2, besoins_par_creneau: { '10:00': 0 }, ordre: 0 };

describe('créneaux de présence', () => {
  it('découpe 10 h → 20 h en tranches de 2 h, sans tranche incomplète', () => {
    expect(tranchesDeLaJournee({ debut: '10:00', fin: '20:00', dureeMinutes: 120 })).toEqual(['10:00', '12:00', '14:00', '16:00', '18:00']);
    expect(tranchesDeLaJournee({ debut: '10:00:00', fin: '13:00:00', dureeMinutes: 120 })).toEqual(['10:00']);
  });

  it('écrit une tranche comme on la dit', () => {
    expect(libelleDeTranche('10:00', 120)).toBe('10 h – 12 h');
    expect(libelleDeTranche('09:30', 90)).toBe('9 h 30 – 11 h');
  });

  it('prend l’exception de la tranche, sinon le nombre du pôle', () => {
    expect(besoinDuCreneau(cafe, '10:00')).toBe(0);
    expect(besoinDuCreneau(cafe, '12:00')).toBe(2);
  });

  it('efface l’exception quand on revient au nombre du pôle', () => {
    expect(changerLeBesoin(cafe, '10:00', 2)).toEqual({});
    expect(changerLeBesoin(cafe, '14:00', 3)).toEqual({ '10:00': 0, '14:00': 3 });
  });

  it('dit l’état d’une case, et l’écrit en toutes lettres', () => {
    expect(etatDuCreneau({ besoin: 3, pris: 3, estAMoi: true })).toBe('vous');
    expect(etatDuCreneau({ besoin: 3, pris: 1, estAMoi: false })).toBe('libre');
    expect(etatDuCreneau({ besoin: 3, pris: 2, estAMoi: false })).toBe('derniere');
    expect(etatDuCreneau({ besoin: 3, pris: 3, estAMoi: false })).toBe('complet');
    expect(etatDuCreneau({ besoin: 0, pris: 0, estAMoi: false })).toBe('ferme');
    expect(libelleDeLEtat('libre', 2)).toBe('2 places libres');
  });

  it('fait le bilan des places sans compter deux fois un trop-plein', () => {
    const pris = (pole: number, heure: string) => (heure === '12:00' ? 5 : 0);
    expect(bilanDesPlaces([cafe], ['10:00', '12:00', '14:00'], pris)).toEqual({ places: 4, prises: 2, libres: 2 });
  });
});
