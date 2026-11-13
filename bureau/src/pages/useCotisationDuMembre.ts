import { useState } from 'react';

import { requeteDeCotisation } from '../cotisation-actions';
import { formatDay, fullName, supabase, toast, type MemberRow } from '../lib';

// Les actions sur la cotisation d'un adhérent, dans sa fiche : enregistrer, annuler, et revenir
// sur le dernier changement (une erreur de clic se corrige d'un geste).

export function useCotisationDuMembre(membre: MemberRow, onChanged: () => void) {
  const [enCours, setEnCours] = useState(false);
  // La date d'avant le dernier changement fait dans cette fiche ; undefined : rien à défaire.
  const [dateAvant, setDateAvant] = useState<string | null | undefined>(undefined);

  async function appliquer(date: string | null, confirmation: string) {
    const { fonction, parametres } = requeteDeCotisation(membre, date);
    setEnCours(true);
    const { error } = await supabase.rpc(fonction, parametres);
    setEnCours(false);
    if (error) {
      toast(error.message, 'error');
      return false;
    }
    toast(confirmation);
    onChanged();
    return true;
  }

  async function enregistrer(date: string) {
    const avant = membre.valide_jusqu;
    if (await appliquer(date, 'Cotisation enregistrée')) setDateAvant(avant);
  }

  async function annulerLaCotisation() {
    if (!confirm(`Annuler la cotisation de ${fullName(membre)} ? Elle repassera « sans cotisation ».`)) return;
    const avant = membre.valide_jusqu;
    if (await appliquer(null, 'Cotisation annulée')) setDateAvant(avant);
  }

  async function defaireLeDernierChangement() {
    if (dateAvant === undefined) return;
    if (await appliquer(dateAvant, 'Changement annulé')) setDateAvant(undefined);
  }

  const libelleDefaire = dateAvant === undefined
    ? null
    : dateAvant ? `Annuler ce changement (revenir au ${formatDay(dateAvant)})` : 'Annuler ce changement (aucune cotisation)';

  return { enCours, enregistrer, annulerLaCotisation, defaireLeDernierChangement, libelleDefaire };
}
