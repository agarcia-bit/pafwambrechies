import { describe, expect, it } from 'vitest';

import { parseImport } from './import-adherents';

describe('parseImport : la fiche d’annuaire préremplie', () => {
  it('lit l’entreprise, l’activité, le téléphone et l’adresse sur plusieurs colonnes', () => {
    const { rows, errors } = parseImport(
      'Prénom;Nom;E-mail;Entreprise;Activité;Téléphone;Adresse;Code postal;Ville\n' +
        'Marie;DUPONT;marie@exemple.fr;Fleurs & Co;Fleuriste;06 12 34 56 78;3 rue Neuve;59118;Wambrechies'
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ prenom: 'Marie', nom: 'Dupont', email: 'marie@exemple.fr' });
    expect(rows[0].fiche).toEqual({
      entreprise: 'Fleurs & Co',
      categorie: 'Fleuriste',
      telephone: '06 12 34 56 78',
      adresse: '3 rue Neuve, 59118, Wambrechies',
    });
  });

  it('ne prend pas « Nom de l’entreprise » pour le nom de famille', () => {
    const { rows } = parseImport('Prénom;Nom;Nom de l’entreprise;E-mail\nPaul;Martin;Optique Martin;paul@exemple.fr');
    expect(rows[0]).toMatchObject({ prenom: 'Paul', nom: 'Martin', fiche: { entreprise: 'Optique Martin' } });
  });

  it('ne crée pas de fiche quand le tableau n’a que les colonnes d’adhésion', () => {
    const { rows } = parseImport('Prénom;Nom;E-mail;Cotisation jusqu’au\nMarie;Dupont;marie@exemple.fr;31/12/2026');
    expect(rows[0].fiche).toBeUndefined();
    expect(rows[0].valide_jusqu).toBe('2026-12-31');
  });

  it('laisse vide un champ absent de la ligne, sans casser les autres', () => {
    const { rows } = parseImport('Prénom;Nom;E-mail;Téléphone;Instagram\nLuc;Petit;luc@exemple.fr;;@luc.petit');
    expect(rows[0].fiche).toEqual({ instagram: '@luc.petit' });
  });

  it('sans en-tête, ne devine pas de fiche', () => {
    const { rows } = parseImport('Marie;Dupont;marie@exemple.fr');
    expect(rows[0].fiche).toBeUndefined();
  });
});
