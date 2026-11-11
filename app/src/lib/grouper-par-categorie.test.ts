import { describe, expect, it } from 'vitest';

import { grouperParCategorie } from './grouper-par-categorie';

const AUTRES = 'Autres liens';

describe('grouperParCategorie', () => {
  it('garde une seule liste sans titre quand rien n’a de catégorie', () => {
    const liens = [{ id: 1, categorie: null }, { id: 2 }];
    expect(grouperParCategorie(liens, AUTRES)).toEqual([{ elements: liens }]);
  });

  it('range par catégorie, dans l’ordre alphabétique, le reste à la fin', () => {
    const groupes = grouperParCategorie(
      [
        { id: 1, categorie: 'Partenaires' },
        { id: 2, categorie: null },
        { id: 3, categorie: 'Mairie' },
        { id: 4, categorie: 'Partenaires' },
      ],
      AUTRES
    );
    expect(groupes.map((g) => [g.titre, g.elements.map((e) => e.id)])).toEqual([
      ['Mairie', [3]],
      ['Partenaires', [1, 4]],
      [AUTRES, [2]],
    ]);
  });

  it('traite une catégorie vide ou en espaces comme absente', () => {
    const groupes = grouperParCategorie([{ id: 1, categorie: ' ' }, { id: 2, categorie: 'Écoles ' }], AUTRES);
    expect(groupes.map((g) => g.titre)).toEqual(['Écoles', AUTRES]);
  });
});
