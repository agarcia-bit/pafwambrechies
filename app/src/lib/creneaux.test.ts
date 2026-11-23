import { describe, expect, it } from 'vitest';

import {
  besoinDuCreneau, billetsDeLaPersonne, creneauxDuPlanning, resumeDesTrous, trousDuPlanning, bilanDesPlaces, changerLeBesoin, estDejaPrisALHeure, etatDuCreneau, etatPourLeBureau, libelleDeLEtat, libelleDeTranche, tranchesDeLaJournee,
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

  it('montre au bureau les trous plutôt que les places', () => {
    expect(etatPourLeBureau(2, 2)).toBe('rempli');
    expect(etatPourLeBureau(2, 1)).toBe('manque');
    expect(etatPourLeBureau(0, 0)).toBe('ferme');
  });

  it('fait les billets d’un membre du bureau, avec ceux qui sont là en même temps', () => {
    const inscrits = [
      { id: 1, pole_id: 1, debut: '12:00', membre: 'andy', nom: 'Andy' },
      { id: 2, pole_id: 1, debut: '12:00', membre: null, nom: 'Léa' },
      { id: 3, pole_id: 1, debut: '10:00', membre: 'andy', nom: 'Andy' },
    ];
    const billets = billetsDeLaPersonne([cafe], inscrits, 'andy');
    expect(billets.map((b) => [b.inscrit.debut, b.nomDuPole, b.avec])).toEqual([['10:00', 'Café', []], ['12:00', 'Café', ['Léa']]]);
    expect(estDejaPrisALHeure(inscrits, 'andy', '12:00')).toBe(true);
    expect(estDejaPrisALHeure(inscrits, 'andy', '14:00')).toBe(false);
  });

  it('liste les trous du plus urgent au moins urgent, et résume le pôle qui manque le plus', () => {
    const buvette = { id: 2, nom: 'Buvette', personnes: 2, besoins_par_creneau: {}, ordre: 1 };
    const inscrits = [
      { id: 1, pole_id: 1, debut: '12:00', membre: null, nom: 'Léa' },
      { id: 2, pole_id: 2, debut: '10:00', membre: null, nom: 'Tom' },
    ];
    const trous = trousDuPlanning([cafe, buvette], ['10:00', '12:00'], inscrits);
    expect(trous.map((t) => `${t.pole.nom} ${t.heure} ${t.manque}`)).toEqual(['Buvette 12:00 2', 'Buvette 10:00 1', 'Café 12:00 1']);
    expect(trous[2].presents).toEqual(['Léa']);
    // Pour soi : « vous » dans la liste, et le créneau est marqué comme le sien.
    const avecMoi = trousDuPlanning([cafe], ['12:00'], [{ id: 3, pole_id: 1, debut: '12:00', membre: 'andy', nom: 'Andy' }], 'andy');
    expect(avecMoi[0]).toMatchObject({ presents: ['vous'], estMoi: true, manque: 1 });
    expect(resumeDesTrous(trous)).toEqual({ manque: 4, poleLePlusEnManque: 'Buvette' });
    expect(resumeDesTrous(trous.slice(1))).toEqual({ manque: 2, poleLePlusEnManque: null });
    // Tous les créneaux, complets compris, sauf ceux qui ne demandent personne (le café à 10 h).
    expect(creneauxDuPlanning([cafe, buvette], ['10:00', '12:00'], inscrits).map((c) => `${c.pole.nom} ${c.heure} ${c.manque}`))
      .toEqual(['Café 12:00 1', 'Buvette 10:00 1', 'Buvette 12:00 2']);
  });
});
