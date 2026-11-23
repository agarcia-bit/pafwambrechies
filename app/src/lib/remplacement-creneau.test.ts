import { describe, expect, it, vi } from 'vitest';

import type { PlanningOuvert } from './mes-creneaux';
import { messageDeRemplacement, placesAReprendre } from './remplacement-creneau';

// vi.mock est remonté avant les imports : le vrai client Supabase n'est jamais créé.
vi.mock('./supabase', () => ({ supabase: {} }));

const marche: PlanningOuvert = {
  id: 1, emoji: null, titre: 'Marché de Noël', date: '2026-12-12', debut: '10:00', fin: '16:00', duree_minutes: 120,
  poles: [
    { id: 1, nom: 'Gaufres', personnes: 2, besoins_par_creneau: {}, pris: { '10:00': 2, '14:00': 1 }, mes_inscriptions: [{ id: 9, debut: '10:00' }], a_reprendre: [{ id: 4, debut: '14:00' }] },
    { id: 2, nom: 'Café', personnes: 1, besoins_par_creneau: {}, pris: { '10:00': 1, '12:00': 1 }, mes_inscriptions: [], a_reprendre: [{ id: 5, debut: '10:00' }, { id: 6, debut: '12:00' }] },
  ],
};

describe('remplacement d’un créneau', () => {
  it('propose les places à reprendre, sauf à une heure où la personne est déjà prise', () => {
    expect(placesAReprendre(marche)).toEqual([
      { inscription: 6, pole: 2, nomDuPole: 'Café', heure: '12:00' },
      { inscription: 4, pole: 1, nomDuPole: 'Gaufres', heure: '14:00' },
    ]);
  });

  it('écrit le message à partager, avec le lien qui ouvre le planning dans l’app', () => {
    expect(messageDeRemplacement(marche, 'samedi 12 décembre', 'Gaufres', '10:00')).toBe(
      'Je ne peux plus venir à « Marché de Noël » samedi 12 décembre (Gaufres, 10 h – 12 h). '
      + 'Quelqu’un peut reprendre ma place ? Dans l’app Allianceo, onglet Agenda, ou ici : allianceo://agenda/creneaux/1',
    );
  });
});
