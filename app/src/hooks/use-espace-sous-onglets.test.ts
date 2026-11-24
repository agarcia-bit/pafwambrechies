import { describe, expect, it, vi } from 'vitest';

import { espaceSousOnglets } from './use-espace-sous-onglets';

// vi.mock est remonté avant les imports : React Native n'est jamais chargé.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, useWindowDimensions: () => ({}) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

describe('espace sous les onglets', () => {
  it('laisse la place de la barre flottante sur un iPhone en portrait', () => {
    expect(espaceSousOnglets({ ios: true, insetBas: 34, largeur: 393, hauteur: 852 })).toBe(114);
  });

  it('ne réserve plus la barre sur l’iPhone pliable ouvert, où les onglets sont sur le côté', () => {
    expect(espaceSousOnglets({ ios: true, insetBas: 20, largeur: 951, hauteur: 669 })).toBe(52);
  });

  it('garde une marge ordinaire sur Android', () => {
    expect(espaceSousOnglets({ ios: false, insetBas: 24, largeur: 412, hauteur: 915 })).toBe(32);
  });
});
