import { describe, expect, it } from 'vitest';

import { requeteDeCotisation } from './cotisation-actions';

const inscrit = { id: 'u1', email: 'anne@ex.fr', prenom: 'Anne', nom: 'Dupont' };
const importe = { id: null, email: 'bob@ex.fr', prenom: 'Bob', nom: null };

describe('requeteDeCotisation', () => {
  it('enregistre ou efface la cotisation d’un adhérent inscrit', () => {
    expect(requeteDeCotisation(inscrit, '2027-12-31')).toEqual({ fonction: 'set_cotisation', parametres: { p_member: 'u1', p_valide_jusqu: '2027-12-31' } });
    expect(requeteDeCotisation(inscrit, null)).toEqual({ fonction: 'clear_cotisation', parametres: { p_member: 'u1' } });
  });

  it('passe par la liste des importés pour un adhérent pas encore inscrit', () => {
    expect(requeteDeCotisation(importe, '2027-12-31')).toEqual({
      fonction: 'importer_adherents',
      parametres: { p_rows: [{ prenom: 'Bob', nom: '', email: 'bob@ex.fr', valide_jusqu: '2027-12-31' }] },
    });
    expect(requeteDeCotisation(importe, null)).toEqual({ fonction: 'effacer_cotisation_invite', parametres: { p_email: 'bob@ex.fr' } });
  });
});
