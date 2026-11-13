import { describe, expect, it } from 'vitest';

import { nomAvecFonction } from './fonction-bureau';

describe('nomAvecFonction', () => {
  it('ajoute la fonction après le nom', () => {
    expect(nomAvecFonction('Andy Agalumy', 'Vice-président')).toBe('Andy Agalumy · Vice-président');
  });
  it('garde le nom seul sans fonction', () => {
    expect(nomAvecFonction('Andy Agalumy', null)).toBe('Andy Agalumy');
    expect(nomAvecFonction('Andy Agalumy', '  ')).toBe('Andy Agalumy');
  });
});
