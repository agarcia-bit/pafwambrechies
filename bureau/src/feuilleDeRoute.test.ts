import { describe, expect, it } from 'vitest';

import { feuilleDeRoute, mentionDImpression, telephoneLisible, texteDuContact } from './feuilleDeRoute';

describe('feuille de route du jour J', () => {
  const buvette = { id: 1, nom: 'Buvette', personnes: 2, besoins_par_creneau: { '12:00': 0 }, ordre: 0 };
  const caisse = { id: 2, nom: 'Caisse', personnes: 1, besoins_par_creneau: { '10:00': 0, '12:00': 0 }, ordre: 1 };
  const inscrits = [
    { pole_id: 1, debut: '10:00', membre: 'zoe', nom: 'Zoé Martin' },
    { pole_id: 1, debut: '10:00', membre: null, nom: 'Albert (voisin)' },
    { pole_id: 1, debut: '12:00', membre: 'tom', nom: 'Tom Leroy' },
  ];

  it('range les noms par ordre alphabétique et ajoute une ligne vide par place libre', () => {
    const feuille = feuilleDeRoute([buvette], ['10:00', '14:00'], 120, inscrits, null);
    expect(feuille[0].tranches[0]).toEqual({
      heure: '10:00', libelle: '10 h – 12 h',
      lignes: [{ nom: 'Albert (voisin)', contact: null }, { nom: 'Zoé Martin', contact: null }],
    });
    expect(feuille[0].tranches[1].lignes).toEqual([{ nom: null, contact: null }, { nom: null, contact: null }]);
  });

  it("garde une tranche fermée où quelqu'un est inscrit, mais pas un pôle sans aucune tranche", () => {
    const feuille = feuilleDeRoute([buvette, caisse], ['10:00', '12:00'], 120, inscrits, null);
    expect(feuille.map((p) => p.nom)).toEqual(['Buvette']);
    expect(feuille[0].tranches.map((t) => t.heure)).toEqual(['10:00', '12:00']);
  });

  it("n'ajoute les coordonnées que des membres qui ont un compte, et seulement si on les fournit", () => {
    const contacts = new Map([['zoe', { email: 'zoe@exemple.fr', telephone: '06 12 34 56 78' }]]);
    const lignes = feuilleDeRoute([buvette], ['10:00'], 120, inscrits, contacts)[0].tranches[0].lignes;
    expect(lignes.map((l) => texteDuContact(l.contact))).toEqual(['', 'zoe@exemple.fr · 06 12 34 56 78']);
    expect(texteDuContact({ email: 'a@b.fr', telephone: ' ' })).toBe('a@b.fr');
    expect(telephoneLisible('0619425918')).toBe('06 19 42 59 18');
    expect(telephoneLisible('06.19.42.59.18')).toBe('06 19 42 59 18');
    expect(telephoneLisible('+33 6 19 42 59 18')).toBe('+33 6 19 42 59 18');
  });

  it("date la feuille sans « aujourd'hui », qui ne voudrait plus rien dire le lendemain", () => {
    expect(mentionDImpression(new Date('2026-11-23T14:40:00Z'))).toBe('Imprimée le 23 novembre à 15 h 40');
    expect(mentionDImpression(new Date('2026-12-12T08:00:00Z'))).toBe('Imprimée le 12 décembre à 9 h');
  });
});
