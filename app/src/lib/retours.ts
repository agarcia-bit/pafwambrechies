import Constants from 'expo-constants';
import { Dimensions, Platform } from 'react-native';

import { deposerPhoto, type PickedPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

// Un retour sur l'application (bug ou idée), envoyé au propriétaire de la plateforme et non au
// bureau (supabase/retours.sql) : la fonction notify-retour lui envoie aussitôt l'e-mail.

export type TypeDeRetour = 'bug' | 'idee';
export const TYPES_DE_RETOUR: readonly TypeDeRetour[] = ['bug', 'idee'];
export const LIBELLES_DES_RETOURS: Record<TypeDeRetour, string> = { bug: 'Un bug', idee: 'Une idée' };

/** Ce qui aide à reproduire un bug : « app · iOS 18.1 · 1.0.0 · 390×844 ». */
export function appareilDuRetour(os: string, versionOs: string | number, versionApp: string | null, largeur: number, hauteur: number) {
  const systeme = { ios: 'iOS', android: 'Android', web: 'Web' }[os] ?? os;
  return {
    support: 'app',
    systeme: `${systeme} ${versionOs}`.trim(),
    version: versionApp ?? 'inconnue',
    ecran: `${Math.round(largeur)}×${Math.round(hauteur)}`,
  };
}

/** Dépose la capture (facultative) dans le dossier de l'auteur, puis enregistre le retour. */
export async function envoyerUnRetour(auteur: string, type: TypeDeRetour, texte: string, capture: PickedPhoto | null) {
  const chemin = capture ? await deposerPhoto(capture, 'retours-captures', auteur) : null;
  const { width, height } = Dimensions.get('window');
  const appareil = appareilDuRetour(Platform.OS, Platform.Version, Constants.expoConfig?.version ?? null, width, height);
  const { error } = await supabase.from('retours').insert({ type, texte: texte.trim(), capture: chemin, appareil });
  if (error) throw error;
}
