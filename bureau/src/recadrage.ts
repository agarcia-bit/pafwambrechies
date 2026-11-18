// Le calcul du recadrage d'une photo de fiche : la photo, affichée dans un cadre 4:3, se déplace
// et se zoome au doigt ; ces fonctions disent ce qu'on voit et la gardent toujours dans le cadre.
// Même calcul que l'app (app/src/lib/recadrage.ts) : les deux projets ne partagent pas de code.

export const ZOOM_MAX = 4;

/** La photo (en pixels) et le cadre où elle s'affiche (en points d'écran). */
export type Cadre = { largeurImage: number; hauteurImage: number; largeurCadre: number; hauteurCadre: number };
/** Le zoom (1 = la photo remplit juste le cadre) et le décalage de son centre, en points d'écran. */
export type Reglage = { zoom: number; x: number; y: number };
export type Zone = { x: number; y: number; largeur: number; hauteur: number };

const borner = (valeur: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, valeur));
};

/** Points d'écran par pixel de la photo : au zoom 1, la photo couvre le cadre sans bande vide. */
export function echelleDAffichage(cadre: Cadre, zoom: number): number {
  return Math.max(cadre.largeurCadre / cadre.largeurImage, cadre.hauteurCadre / cadre.hauteurImage) * zoom;
}

/** Ramène le réglage dans ce qui est permis : jamais de bande vide dans le cadre. */
export function limiterReglage(cadre: Cadre, reglage: Reglage): Reglage {
  const zoom = borner(reglage.zoom, 1, ZOOM_MAX);
  const echelle = echelleDAffichage(cadre, zoom);
  const margeX = Math.max(0, (cadre.largeurImage * echelle - cadre.largeurCadre) / 2);
  const margeY = Math.max(0, (cadre.hauteurImage * echelle - cadre.hauteurCadre) / 2);
  return { zoom, x: borner(reglage.x, -margeX, margeX), y: borner(reglage.y, -margeY, margeY) };
}

/** La partie de la photo visible dans le cadre, en pixels de la photo. */
export function zoneDeRecadrage(cadre: Cadre, reglage: Reglage): Zone {
  const { zoom, x, y } = limiterReglage(cadre, reglage);
  const echelle = echelleDAffichage(cadre, zoom);
  const largeur = Math.min(cadre.largeurImage, Math.round(cadre.largeurCadre / echelle));
  const hauteur = Math.min(cadre.hauteurImage, Math.round(cadre.hauteurCadre / echelle));
  // Décaler la photo vers la droite montre sa partie gauche : d'où le signe moins.
  const gauche = cadre.largeurImage / 2 - x / echelle - largeur / 2;
  const haut = cadre.hauteurImage / 2 - y / echelle - hauteur / 2;
  return {
    x: Math.round(borner(gauche, 0, cadre.largeurImage - largeur)),
    y: Math.round(borner(haut, 0, cadre.hauteurImage - hauteur)),
    largeur,
    hauteur,
  };
}
