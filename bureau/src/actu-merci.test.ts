import { describe, expect, it } from 'vitest';

import { actuDeRemerciement, adresseDeLActuPreremplie, bilanDeLaJournee } from './actu-merci';

const inscrits = [
  { membre: 'lea', nom: 'Léa', presence: 'venu' as const },
  { membre: 'lea', nom: 'Léa', presence: null },
  { membre: null, nom: 'Tom Martin', presence: null },
  { membre: null, nom: 'Max', presence: 'absent' as const },
];

describe('actu de remerciement', () => {
  it('compte les créneaux tenus et les personnes, sans les absents', () => {
    expect(bilanDeLaJournee(inscrits)).toEqual({ creneaux: 3, benevoles: 2 });
  });

  it('écrit une actu sans aucun nom', () => {
    const actu = actuDeRemerciement('Marché de Noël', 'samedi 12 décembre', inscrits);
    expect(actu.titre).toBe('Merci aux bénévoles de « Marché de Noël » !');
    expect(actu.contenu).toBe('Samedi 12 décembre, 2 bénévoles ont tenu 3 créneaux. Merci à chacun pour son temps et sa bonne humeur : sans vous, rien n’aurait été possible. À la prochaine !');
    expect(actu.contenu).not.toContain('Léa');
  });

  it('prépare l’adresse du formulaire prérempli', () => {
    const adresse = adresseDeLActuPreremplie({ titre: 'Merci !', contenu: 'Bravo & merci' });
    const parametres = new URLSearchParams(adresse.split('?')[1]);
    expect([parametres.get('nouveau'), parametres.get('titre'), parametres.get('contenu')]).toEqual(['1', 'Merci !', 'Bravo & merci']);
  });
});
