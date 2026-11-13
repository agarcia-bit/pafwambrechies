import { useEffect, useState } from 'react';

import { hashParam, today } from '../lib';
import { brouillonPourEvenement, type BrouillonAction } from '../modeles-actions';
import type { CalEvent } from './PilotageViews';

// Quelle fiche d'action est ouverte dans le Pilotage, et avec quoi une nouvelle action démarre.
//   #pilotage?action=12   ouvre la fiche (lien depuis la Discussion) ;
//   #pilotage?preparer=7  ouvre une nouvelle action préremplie pour l'événement 7 de l'agenda
//                         (bouton « Préparer cet événement » de la page Événements).

export function useOuvertureDeFiche(evenements: CalEvent[] | undefined) {
  const [ouverte, setOuverte] = useState<number | 'new' | null>(() => Number(hashParam('action')) || null);
  const [depart, setDepart] = useState<BrouillonAction | null>(null);
  const [evenementAPreparer, setEvenementAPreparer] = useState<number | null>(() => Number(hashParam('preparer')) || null);

  useEffect(() => {
    const surChangementDAdresse = () => {
      const action = Number(hashParam('action'));
      if (action) setOuverte(action);
      setEvenementAPreparer(Number(hashParam('preparer')) || null);
    };
    addEventListener('hashchange', surChangementDAdresse);
    return () => removeEventListener('hashchange', surChangementDAdresse);
  }, []);

  // L'événement demandé dans l'adresse : dès que l'agenda est chargé, sa fiche s'ouvre préremplie.
  useEffect(() => {
    if (!evenementAPreparer || !evenements) return;
    const evenement = evenements.find((e) => e.id === evenementAPreparer);
    setEvenementAPreparer(null);
    if (!evenement) return;
    setDepart(brouillonPourEvenement(evenement, today()));
    setOuverte('new');
  }, [evenementAPreparer, evenements]);

  return {
    ouverte,
    depart,
    ouvrir: setOuverte,
    ouvrirNouvelle(brouillon: BrouillonAction | null = null) {
      setDepart(brouillon);
      setOuverte('new');
    },
    fermer() {
      setOuverte(null);
      setDepart(null);
      // L'adresse redevient celle de la page : recharger ne rouvre pas la fiche.
      if (location.hash.includes('?')) history.replaceState(null, '', '#pilotage');
    },
  };
}
