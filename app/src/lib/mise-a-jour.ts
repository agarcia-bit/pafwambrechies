/** Ce que le membre voit : rien, l'écran « Mise à jour en cours… », ou la consigne de rouvrir l'app. */
export type EtatDeMiseAJour = 'rien' | 'en-cours' | 'a-rouvrir';

/** Les trois gestes d'expo-updates, passés en paramètre pour pouvoir les remplacer dans les tests. */
export type OutilsDeMiseAJour = {
  verifier: () => Promise<{ isAvailable: boolean }>;
  telecharger: () => Promise<{ isNew: boolean }>;
  recharger: () => Promise<void>;
};

// Au-delà, on laisse entrer le membre : une mise à jour ne doit jamais bloquer l'app (réseau lent, tunnel).
export const DELAI_MAX_DE_TELECHARGEMENT_MS = 12_000;
// Une app revenue au premier plan après une courte absence ne se recharge pas : le membre était
// peut-être en train d'écrire, et un rechargement efface sa saisie.
export const ABSENCE_MIN_AVANT_VERIFICATION_MS = 10 * 60_000;

function attendreAuPlus<T>(promesse: Promise<T>, delaiMs: number): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error('délai dépassé')), delaiMs);
    promesse.then(resoudre, rejeter).finally(() => clearTimeout(minuteur));
  });
}

/**
 * Cherche une mise à jour, la télécharge et recharge l'app. L'écran n'apparaît qu'une fois la
 * nouveauté confirmée. Toute panne avant le rechargement rend la main sans rien dire : la mise à
 * jour passera à la prochaine ouverture, comme avant.
 */
export async function appliquerLaMiseAJour(
  outils: OutilsDeMiseAJour,
  surEtat: (etat: EtatDeMiseAJour) => void,
  delaiMs = DELAI_MAX_DE_TELECHARGEMENT_MS,
): Promise<void> {
  try {
    const { isAvailable } = await attendreAuPlus(outils.verifier(), delaiMs);
    if (!isAvailable) return;
    surEtat('en-cours');
    const { isNew } = await attendreAuPlus(outils.telecharger(), delaiMs);
    if (!isNew) return surEtat('rien');
  } catch {
    return surEtat('rien');
  }
  try {
    await outils.recharger();
  } catch {
    // Téléchargée mais impossible à lancer d'ici : seul un vrai redémarrage par le membre l'appliquera.
    surEtat('a-rouvrir');
  }
}

/** Vrai si l'app est restée assez longtemps en arrière-plan pour revérifier à son retour. */
export function doitReverifierAuRetour(partieA: number | null, maintenant: number): boolean {
  return partieA !== null && maintenant - partieA >= ABSENCE_MIN_AVANT_VERIFICATION_MS;
}
