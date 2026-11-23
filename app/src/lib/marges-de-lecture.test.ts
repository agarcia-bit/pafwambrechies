import { describe, expect, it } from 'vitest';

import { margesDeLecture } from './marges-de-lecture';

describe('marges de lecture', () => {
  it('ne laisse que les bords occupés sur un téléphone', () => {
    expect(margesDeLecture(466, { gauche: 0, droite: 84 })).toEqual({ gauche: 0, droite: 84 });
  });

  it('centre une colonne de 640 points sur grand écran, hors des bords occupés', () => {
    expect(margesDeLecture(951, { gauche: 0, droite: 71 })).toEqual({ gauche: 120, droite: 191 });
  });
});
