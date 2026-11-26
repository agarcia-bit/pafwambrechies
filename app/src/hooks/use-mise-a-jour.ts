import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { appliquerLaMiseAJour, doitReverifierAuRetour, type EtatDeMiseAJour } from '@/lib/mise-a-jour';

const outils = {
  verifier: () => Updates.checkForUpdateAsync(),
  telecharger: () => Updates.fetchUpdateAsync(),
  recharger: () => Updates.reloadAsync(),
};

/**
 * Applique une mise à jour dès l'ouverture, et au retour d'une longue absence : sans cela, une
 * nouveauté ne s'affichait qu'à la deuxième ouverture, et jamais chez qui laisse l'app en arrière-plan.
 */
export function useMiseAJour() {
  const [etat, setEtat] = useState<EtatDeMiseAJour>('rien');
  const partieA = useRef<number | null>(null);

  useEffect(() => {
    // En développement et sur le web, expo-updates est éteint et ses fonctions refusent de répondre.
    if (__DEV__ || !Updates.isEnabled) return;
    appliquerLaMiseAJour(outils, setEtat);
    const abonnement = AppState.addEventListener('change', (etatDeLApp) => {
      if (etatDeLApp !== 'active') {
        partieA.current ??= Date.now();
        return;
      }
      if (doitReverifierAuRetour(partieA.current, Date.now())) appliquerLaMiseAJour(outils, setEtat);
      partieA.current = null;
    });
    return () => abonnement.remove();
  }, []);

  return { etat, onContinuer: () => setEtat('rien') };
}
