import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sur iPhone, la barre d'onglets flotte au-dessus du contenu : sans cette marge, le bas de la
// dernière carte (J'aime, Lu…) reste caché dessous et ne peut plus être touché.
// Sur Android, la barre est posée sous l'écran : une marge ordinaire suffit.
// L'app est verrouillée en portrait : une fenêtre plus large que haute, c'est l'iPhone pliable
// ouvert, où les onglets passent en colonne sur le côté. Rien ne flotte alors en bas de l'écran.
const HAUTEUR_BARRE_IOS = 80;
const MARGE_ORDINAIRE = 32;

type Ecran = { ios: boolean; insetBas: number; largeur: number; hauteur: number };

/** La marge à laisser en bas, selon l'appareil et la place de la barre d'onglets. */
export function espaceSousOnglets({ ios, insetBas, largeur, hauteur }: Ecran): number {
  const barreEnBas = ios && largeur <= hauteur;
  if (barreEnBas) return insetBas + HAUTEUR_BARRE_IOS;
  return ios ? insetBas + MARGE_ORDINAIRE : MARGE_ORDINAIRE;
}

/** La marge à laisser en bas d'une liste d'onglet pour que tout reste visible et cliquable. */
export function useEspaceSousOnglets() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return espaceSousOnglets({ ios: Platform.OS === 'ios', insetBas: insets.bottom, largeur: width, hauteur: height });
}
