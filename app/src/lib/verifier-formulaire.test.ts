import { describe, expect, it } from 'vitest';

import type { Field } from './admin';
import { erreurDuFormulaire } from './verifier-formulaire';

const fields: Field[] = [
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'video_url', label: 'Vidéo', type: 'url' },
];

describe('erreurDuFormulaire', () => {
  it('réclame d’abord le champ obligatoire resté vide', () => {
    expect(erreurDuFormulaire({ fields, verifier: () => 'autre' }, { titre: '  ' })).toBe('Le champ « Titre » est obligatoire.');
  });

  it('donne ensuite le refus propre à la collection', () => {
    expect(erreurDuFormulaire({ fields, verifier: () => 'Lien refusé' }, { titre: 'Loto' })).toBe('Lien refusé');
  });

  it('ne dit rien quand tout est bon', () => {
    expect(erreurDuFormulaire({ fields, verifier: () => null }, { titre: 'Loto' })).toBeNull();
    expect(erreurDuFormulaire({ fields }, { titre: 'Loto' })).toBeNull();
  });
});
