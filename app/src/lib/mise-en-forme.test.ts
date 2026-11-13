import { describe, expect, it } from 'vitest';

import { decouperMiseEnForme } from './mise-en-forme';

describe('decouperMiseEnForme', () => {
  it('met en italique le texte entre astérisques, sans les astérisques', () => {
    expect(decouperMiseEnForme('Nous annonçons que *Sébastien rejoint le bureau.* Bravo')).toEqual([
      { texte: 'Nous annonçons que ' },
      { texte: 'Sébastien rejoint le bureau.', italique: true },
      { texte: ' Bravo' },
    ]);
  });

  it('met en gras le texte entre doubles astérisques', () => {
    expect(decouperMiseEnForme('**Important** : demain')).toEqual([{ texte: 'Important', gras: true }, { texte: ' : demain' }]);
  });

  it('laisse un astérisque isolé ou collé à une espace', () => {
    expect(decouperMiseEnForme('5 * 3 = 15')).toEqual([{ texte: '5 * 3 = 15' }]);
    expect(decouperMiseEnForme('* pas fermé')).toEqual([{ texte: '* pas fermé' }]);
  });

  it('rend un texte sans mise en forme d’un seul morceau', () => {
    expect(decouperMiseEnForme('Bonjour')).toEqual([{ texte: 'Bonjour' }]);
  });
});
