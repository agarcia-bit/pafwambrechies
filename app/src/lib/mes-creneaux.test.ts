import { describe, expect, it, vi } from 'vitest';

import { billetsDuPlanning, casesDuPole, resumeDuPlanning, type PlanningOuvert } from './mes-creneaux';

// vi.mock est remonté avant les imports : le vrai client Supabase n'est jamais créé.
vi.mock('./supabase', () => ({ supabase: {} }));

const marche: PlanningOuvert = {
  id: 1, emoji: '🎄', titre: 'Marché de Noël', date: '2026-12-12', debut: '10:00', fin: '16:00', duree_minutes: 120,
  poles: [
    { id: 1, nom: 'Gaufres', personnes: 2, besoins_par_creneau: {}, pris: { '10:00': 2, '12:00': 1 }, mes_inscriptions: [{ id: 9, debut: '10:00' }] },
    { id: 2, nom: 'Café', personnes: 1, besoins_par_creneau: { '10:00': 0 }, pris: { '14:00': 1 }, mes_inscriptions: [] },
  ],
};

describe('mes créneaux', () => {
  it('montre « Vous », la dernière place et les places libres d’un pôle', () => {
    expect(casesDuPole(marche, marche.poles[0])).toEqual([
      { heure: '10:00', etat: 'vous', libres: 0, inscription: 9 },
      { heure: '12:00', etat: 'derniere', libres: 1, inscription: null },
      { heure: '14:00', etat: 'libre', libres: 2, inscription: null },
    ]);
  });

  it('cache les tranches où le pôle n’a besoin de personne', () => {
    expect(casesDuPole(marche, marche.poles[1]).map((c) => `${c.heure} ${c.etat}`)).toEqual(['12:00 derniere', '14:00 complet']);
  });

  it('résume les places libres et les créneaux de la personne', () => {
    expect(resumeDuPlanning(marche)).toEqual({ libres: 4, mesCreneaux: [{ pole: 'Gaufres', heure: '10:00' }] });
  });

  it('fait un billet par créneau de la personne, avec les autres bénévoles', () => {
    expect(billetsDuPlanning(marche)).toEqual([{ inscription: 9, pole: 1, nomDuPole: 'Gaufres', heure: '10:00', autres: 1 }]);
  });
});
