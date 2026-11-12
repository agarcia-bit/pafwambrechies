import { describe, expect, it, vi } from 'vitest';

// Le client Supabase n'a pas à exister pour tester les règles de calcul.
vi.mock('./lib', () => ({ supabase: {} }));

import {
  calculerNote, classerEngagement, compterInteractions, compterParStatut, completerSemaines, SEUIL_ACTIF, tonDeLaNote, type MembreEngagement,
} from './engagement';

const membre = (jours_visite: number, derniere_visite: string | null) => ({ jours_visite, derniere_visite });

describe('classerEngagement', () => {
  it('range comme « Jamais vu » un adhérent sans aucune visite', () => {
    expect(classerEngagement(membre(0, null))).toBe('jamais_vu');
  });
  it('range comme « Actif » à partir du seuil de jours de visite', () => {
    expect(classerEngagement(membre(SEUIL_ACTIF, '2026-11-09'))).toBe('actif');
    expect(classerEngagement(membre(SEUIL_ACTIF + 10, '2026-11-09'))).toBe('actif');
  });
  it('range comme « Occasionnel » entre 1 jour et le seuil', () => {
    expect(classerEngagement(membre(1, '2026-11-09'))).toBe('occasionnel');
    expect(classerEngagement(membre(SEUIL_ACTIF - 1, '2026-11-09'))).toBe('occasionnel');
  });
  it('range comme « Décroché » un adhérent déjà venu mais pas sur la période', () => {
    expect(classerEngagement(membre(0, '2026-08-01'))).toBe('decroche');
  });
});

describe('compterParStatut', () => {
  it('compte chaque statut, y compris ceux qui sont à zéro', () => {
    const comptes = compterParStatut([membre(8, '2026-11-09'), membre(2, '2026-11-08'), membre(0, null), membre(0, null)]);
    expect(comptes).toEqual({ actif: 1, occasionnel: 1, decroche: 0, jamais_vu: 2 });
  });
});

describe('compterInteractions', () => {
  it('additionne likes, commentaires, réponses et propositions, sans les visites ni les lectures', () => {
    const adherent = {
      jours_visite: 12, actus_lues: 9, likes: 3, commentaires: 2, sondages: 1, evenements: 2, idees: 1, offres: 0,
    } as MembreEngagement;
    expect(compterInteractions(adherent)).toBe(9);
  });
});

describe('completerSemaines', () => {
  it('donne les semaines du lundi, la plus ancienne en premier, à zéro quand personne n’est venu', () => {
    const mercredi = new Date(2026, 10, 11);
    const semaines = completerSemaines([{ semaine: '2026-11-09', actifs: 4 }], 3, mercredi);
    expect(semaines).toEqual([
      { semaine: '2026-10-26', actifs: 0 },
      { semaine: '2026-11-02', actifs: 0 },
      { semaine: '2026-11-09', actifs: 4 },
    ]);
  });
  it('rattache un dimanche à la semaine commencée le lundi précédent', () => {
    const dimanche = new Date(2026, 10, 15);
    expect(completerSemaines([], 1, dimanche)).toEqual([{ semaine: '2026-11-09', actifs: 0 }]);
  });
});

const complet = (champs: Partial<MembreEngagement> = {}): MembreEngagement => ({
  id: 'a', prenom: 'Anne', nom: null, role: 'adherent', inscrit_le: '2026-10-01', jours_visite: 0, derniere_visite: null,
  actus_lues: 0, likes: 0, commentaires: 0, sondages: 0, evenements: 0, idees: 0, offres: 0,
  fiche_annuaire: false, notifications: false, ...champs,
});

describe('calculerNote', () => {
  it('donne 0 à un adhérent qui n’a rien fait', () => {
    expect(calculerNote(complet(), 5)).toEqual({ venir: 0, lire: 0, participer: 0, profil: 0, note: 0 });
  });
  it('donne 100 à un adhérent au maximum partout, sans dépasser', () => {
    const detail = calculerNote(complet({ jours_visite: 30, actus_lues: 9, commentaires: 50, fiche_annuaire: true, notifications: true }), 5);
    expect(detail).toEqual({ venir: 40, lire: 20, participer: 30, profil: 10, note: 100 });
  });
  it('compte chaque action selon son poids', () => {
    // 2 likes (2) + 1 sondage (2) + 1 commentaire (3) = 7
    expect(calculerNote(complet({ likes: 2, sondages: 1, commentaires: 1 }), 0).participer).toBe(7);
  });
  it('ramène la note sur 100 quand aucune actu n’a été publiée', () => {
    // 6 jours sur 12 = 20 ; profil complet = 10 ; (20 + 10) / 80 = 38 %
    const detail = calculerNote(complet({ jours_visite: 6, fiche_annuaire: true, notifications: true }), 0);
    expect(detail.lire).toBeNull();
    expect(detail.note).toBe(38);
  });
});

describe('tonDeLaNote', () => {
  it('colore en vert, bleu ou orange', () => {
    expect([tonDeLaNote(60), tonDeLaNote(59), tonDeLaNote(30), tonDeLaNote(29)]).toEqual(['ok', 'info', 'info', 'warn']);
  });
});
