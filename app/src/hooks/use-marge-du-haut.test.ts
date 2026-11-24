import { describe, expect, it, vi } from 'vitest';

import { margeDuHaut } from './use-marge-du-haut';

// vi.mock est remonté avant les imports : React Native n'est jamais chargé.
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, StatusBar: {} }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));


describe('marge du haut', () => {
  it('prend la barre d’état quand la marge mesurée vaut 0 (Android, dans les onglets)', () => {
    expect(margeDuHaut(0, 28)).toBe(28);
  });

  it('garde la marge mesurée quand elle est juste ou plus grande', () => {
    expect(margeDuHaut(48, 28)).toBe(48);
    expect(margeDuHaut(47, undefined)).toBe(47);
  });
});
