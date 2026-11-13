import { describe, expect, it } from 'vitest';

import { categoriesUtilisees, reprendreCategorieExistante } from './categories-libres';

describe('categoriesUtilisees', () => {
  it('garde une seule écriture par catégorie, triée, sans les vides', () => {
    expect(categoriesUtilisees(['Mairie', 'Matinale Expert', null, '  ', 'matinale  expert', 'Écoles', 3])).toEqual(['Écoles', 'Mairie', 'Matinale Expert']);
  });
});

describe('reprendreCategorieExistante', () => {
  const existantes = ['Matinale Expert', 'Écoles'];
  it('reprend l’orthographe existante malgré la casse, les accents ou les espaces', () => {
    expect(reprendreCategorieExistante('matinale  expert ', existantes)).toBe('Matinale Expert');
    expect(reprendreCategorieExistante('ecoles', existantes)).toBe('Écoles');
  });
  it('garde une nouvelle catégorie telle quelle, nettoyée', () => {
    expect(reprendreCategorieExistante('  Mairie ', existantes)).toBe('Mairie');
    expect(reprendreCategorieExistante('   ', existantes)).toBe('');
  });
});
