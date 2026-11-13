import { describe, expect, it } from 'vitest';

import { nomsDesContacts } from './contacts-fiche';

describe('nomsDesContacts', () => {
  it('met le titulaire puis ses collègues', () => {
    expect(nomsDesContacts({ prenom: 'Ewan', nom: 'Ros' }, [{ prenom: 'Marie', nom: 'Dupont' }])).toBe('Ewan Ros, Marie Dupont');
  });
  it('ignore les noms vides et les doublons', () => {
    expect(nomsDesContacts({ prenom: null, nom: null }, [{ prenom: 'Marie', nom: null }, { prenom: 'Marie', nom: null }])).toBe('Marie');
  });
});
