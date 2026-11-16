import { describe, expect, it } from 'vitest';

import { MODELES, brouillonDepuisModele, brouillonPourEvenement, decalerLesTaches, echeanceDeLaTache } from './modeles-actions';

describe('echeanceDeLaTache', () => {
  it('compte les jours avant la date de l’action', () => {
    expect(echeanceDeLaTache('2026-12-12', 7, '2026-11-13')).toBe('2026-12-05');
  });
  it('place après l’action une tâche de bilan (jours négatifs)', () => {
    expect(echeanceDeLaTache('2026-12-12', -2, '2026-11-13')).toBe('2026-12-14');
  });
  it('ne donne jamais une échéance déjà passée', () => {
    expect(echeanceDeLaTache('2026-11-26', 30, '2026-11-13')).toBe('2026-11-13');
  });
});

describe('brouillonDepuisModele', () => {
  it('reprend l’icône, le titre et toutes les tâches du modèle, datées', () => {
    const brouillon = brouillonDepuisModele(MODELES[1], '2027-03-20', '2026-11-13');
    expect(brouillon.emoji).toBe('🏛️');
    expect(brouillon.titre).toBe('Assemblée générale');
    expect(brouillon.taches).toHaveLength(MODELES[1].taches.length);
    expect(brouillon.taches[2]).toEqual({ libelle: 'Envoyer la convocation et l’ordre du jour', echeance: '2027-03-05', priorite: 'Haute' });
  });
});

describe('brouillonPourEvenement', () => {
  it('nomme l’action d’après l’événement et retire la tâche de création', () => {
    const brouillon = brouillonPourEvenement({ titre: 'Matinale Expert', date: '2026-11-26' }, '2026-11-13');
    expect(brouillon.titre).toBe('Préparer : Matinale Expert');
    expect(brouillon.date_action).toBe('2026-11-26');
    expect(brouillon.taches.some((t) => t.libelle.startsWith('Créer l’événement'))).toBe(false);
    expect(brouillon.taches.every((t) => t.echeance >= '2026-11-13')).toBe(true);
  });
});

describe('decalerLesTaches', () => {
  const taches = [{ libelle: 'Inviter', echeance: '2026-12-01', priorite: 'Moyenne' as const }, { libelle: 'Sans date', echeance: '', priorite: 'Basse' as const }];
  it('décale les échéances du même nombre de jours que l’action', () => {
    expect(decalerLesTaches(taches, '2026-12-12', '2026-12-19', '2026-11-13').map((t) => t.echeance)).toEqual(['2026-12-08', '']);
  });
  it('ne repasse pas dans le passé et ne touche à rien si la date est la même', () => {
    expect(decalerLesTaches(taches, '2026-12-12', '2026-11-20', '2026-11-13')[0].echeance).toBe('2026-11-13');
    expect(decalerLesTaches(taches, '2026-12-12', '2026-12-12', '2026-11-13')).toBe(taches);
  });
});
