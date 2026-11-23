import { describe, expect, it } from 'vitest';

import { adapterReglageAuCadre, limiterReglage, zoneDeRecadrage, type Cadre } from './recadrage';

// Une photo 4000×3000 dans un cadre 400×300 : au zoom 1, une pixel d'écran = 10 pixels de photo.
const paysage: Cadre = { largeurImage: 4000, hauteurImage: 3000, largeurCadre: 400, hauteurCadre: 300 };
// Une photo verticale 3000×4000 : au zoom 1 elle déborde en haut et en bas.
const portrait: Cadre = { largeurImage: 3000, hauteurImage: 4000, largeurCadre: 400, hauteurCadre: 300 };

describe('recadrage', () => {
  it('sans réglage, garde toute la photo quand elle a déjà le bon format', () => {
    expect(zoneDeRecadrage(paysage, { zoom: 1, x: 0, y: 0 })).toEqual({ x: 0, y: 0, largeur: 4000, hauteur: 3000 });
  });

  it('une photo verticale se coupe au centre, puis se remonte en la faisant glisser vers le bas', () => {
    expect(zoneDeRecadrage(portrait, { zoom: 1, x: 0, y: 0 })).toEqual({ x: 0, y: 875, largeur: 3000, hauteur: 2250 });
    expect(zoneDeRecadrage(portrait, { zoom: 1, x: 0, y: 1000 }).y).toBe(0);
  });

  it('zoomer ×2 garde le quart de la photo, déplaçable sans sortir du cadre', () => {
    expect(zoneDeRecadrage(paysage, { zoom: 2, x: 0, y: 0 })).toEqual({ x: 1000, y: 750, largeur: 2000, hauteur: 1500 });
    expect(zoneDeRecadrage(paysage, { zoom: 2, x: 9999, y: -9999 })).toEqual({ x: 0, y: 1500, largeur: 2000, hauteur: 1500 });
  });

  it('borne le zoom et le décalage pour ne jamais laisser de bande vide', () => {
    expect(limiterReglage(paysage, { zoom: 0.5, x: 50, y: 0 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(limiterReglage(paysage, { zoom: 10, x: 0, y: 0 }).zoom).toBe(4);
  });

  it('quand le cadre change de taille, la même partie de la photo reste visible', () => {
    const reglage = { zoom: 2, x: 100, y: -50 };
    const grand: Cadre = { ...paysage, largeurCadre: 520, hauteurCadre: 390 };
    const adapte = adapterReglageAuCadre(paysage, grand, reglage);
    expect(adapte).toEqual({ zoom: 2, x: 130, y: -65 });
    expect(zoneDeRecadrage(grand, adapte)).toEqual(zoneDeRecadrage(paysage, reglage));
  });
});
