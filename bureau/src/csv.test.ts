import { describe, expect, it } from 'vitest';

import { texteCsv } from './csv';

describe('export CSV', () => {
  it('sépare par des points-virgules et protège les guillemets', () => {
    expect(texteCsv(['Nom', 'Créneaux'], [['Léa "la fée"', 3], [null, 0]]))
      .toBe('"Nom";"Créneaux"\n"Léa ""la fée""";"3"\n"";"0"');
  });
});
