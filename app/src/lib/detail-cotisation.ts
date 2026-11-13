// Le texte de la fenêtre « Ma cotisation » : la situation de l'adhérent, le montant, comment payer,
// et pendant la campagne le message libre du bureau (code promo, conditions…).

export type SituationCotisation = {
  /** La phrase sur sa situation : « Votre adhésion est valable jusqu'au… ». */
  situation: string;
  aRenouveler: boolean;
  campagneOuverte: boolean;
  peutPayerEnLigne: boolean;
  montant: string;
  messageDuBureau: string;
};

export function lignesDuDetailCotisation(s: SituationCotisation): string[] {
  const lignes = [s.situation];
  if (s.aRenouveler && s.montant) lignes.push(`Montant : ${s.montant}.`);
  // Le message parle du renouvellement : il ne concerne que ceux qui ont à renouveler, pendant la campagne.
  if (s.aRenouveler && s.campagneOuverte && s.messageDuBureau.trim()) lignes.push(s.messageDuBureau.trim());
  if (s.peutPayerEnLigne) lignes.push('Le paiement se fait sur le site de l’association ; le bureau met ensuite à jour votre statut.');
  else if (s.aRenouveler) lignes.push('Rapprochez-vous du bureau pour régler votre cotisation.');
  return lignes;
}
