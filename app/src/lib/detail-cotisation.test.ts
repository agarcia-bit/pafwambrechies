import { describe, expect, it } from 'vitest';

import { lignesDuDetailCotisation, type SituationCotisation } from './detail-cotisation';

const base: SituationCotisation = {
  situation: 'Votre adhésion est valable jusqu’au 31 décembre 2026.',
  aRenouveler: true,
  campagneOuverte: true,
  peutPayerEnLigne: true,
  montant: '150 €',
  messageDuBureau: 'Code promo RENOUV27 : -20 € jusqu’au 15 décembre.',
};

describe('lignesDuDetailCotisation', () => {
  it('ajoute le message du bureau après le montant, pendant la campagne', () => {
    expect(lignesDuDetailCotisation(base)).toEqual([
      base.situation,
      'Montant : 150 €.',
      'Code promo RENOUV27 : -20 € jusqu’au 15 décembre.',
      'Le paiement se fait sur le site de l’association ; le bureau met ensuite à jour votre statut.',
    ]);
  });

  it('ne montre pas le message hors campagne ni à un adhérent à jour', () => {
    expect(lignesDuDetailCotisation({ ...base, campagneOuverte: false })).not.toContain(base.messageDuBureau);
    expect(lignesDuDetailCotisation({ ...base, aRenouveler: false, peutPayerEnLigne: false })).toEqual([base.situation]);
  });

  it('ignore un message vide et renvoie vers le bureau sans paiement en ligne', () => {
    expect(lignesDuDetailCotisation({ ...base, messageDuBureau: '  ', peutPayerEnLigne: false })).toEqual([
      base.situation,
      'Montant : 150 €.',
      'Rapprochez-vous du bureau pour régler votre cotisation.',
    ]);
  });
});
