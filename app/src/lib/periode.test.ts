import { describe, expect, it } from 'vitest';

import {
  compterPresentsParJour,
  dernierJour,
  detailsEvenement,
  estSurPlusieursJours,
  formatPeriode,
  joursDeLEvenement,
  resumerJoursChoisis,
} from './periode';

describe('estSurPlusieursJours et dernierJour', () => {
  it('traite un événement sans date de fin comme un seul jour', () => {
    expect(estSurPlusieursJours({ date: '2026-06-12' })).toBe(false);
    expect(dernierJour({ date: '2026-06-12', date_fin: null })).toBe('2026-06-12');
  });
  it('prend la date de fin comme dernier jour', () => {
    expect(estSurPlusieursJours({ date: '2026-06-12', date_fin: '2026-06-14' })).toBe(true);
    expect(dernierJour({ date: '2026-06-12', date_fin: '2026-06-14' })).toBe('2026-06-14');
  });
});

describe('joursDeLEvenement', () => {
  it('liste chaque jour, y compris à cheval sur deux mois', () => {
    expect(joursDeLEvenement({ date: '2026-05-30', date_fin: '2026-06-02' })).toEqual([
      '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
    ]);
  });
  it('donne le seul jour d’un événement d’un jour', () => {
    expect(joursDeLEvenement({ date: '2026-06-12' })).toEqual(['2026-06-12']);
  });
});

describe('formatPeriode', () => {
  it('écrit un seul jour comme avant', () => {
    expect(formatPeriode({ date: '2026-06-12' })).toBe('Vendredi 12 juin 2026');
  });
  it('n’écrit le mois qu’une fois dans le même mois', () => {
    expect(formatPeriode({ date: '2026-06-12', date_fin: '2026-06-14' })).toBe('Du vendredi 12 au dimanche 14 juin 2026');
  });
  it('écrit les deux mois quand ils diffèrent', () => {
    expect(formatPeriode({ date: '2026-05-30', date_fin: '2026-06-02' })).toBe('Du samedi 30 mai au mardi 2 juin 2026');
  });
  it('écrit les deux années quand elles diffèrent', () => {
    expect(formatPeriode({ date: '2026-12-31', date_fin: '2027-01-02' })).toBe('Du jeudi 31 décembre 2026 au samedi 2 janvier 2027');
  });
});

describe('resumerJoursChoisis', () => {
  it('dit « Toute la durée » sans jour précisé', () => {
    expect(resumerJoursChoisis(null)).toBe('Toute la durée');
    expect(resumerJoursChoisis([])).toBe('Toute la durée');
  });
  it('liste les jours choisis dans l’ordre', () => {
    expect(resumerJoursChoisis(['2026-06-14', '2026-06-13'])).toBe('sam. 13, dim. 14');
  });
});

describe('detailsEvenement', () => {
  it('annonce la fin d’un événement sur plusieurs jours', () => {
    expect(detailsEvenement({ date: '2026-06-12', date_fin: '2026-06-14', heure: '09:00 – 18:00', lieu: 'Salle des fêtes' })).toBe(
      'Jusqu’au dimanche 14 juin · 09:00 – 18:00 · Salle des fêtes'
    );
  });
  it('reste comme avant pour un seul jour', () => {
    expect(detailsEvenement({ date: '2026-06-12', heure: '19:00', lieu: 'À définir' })).toBe('19:00');
  });
});

describe('compterPresentsParJour', () => {
  it('compte un présent « toute la durée » chaque jour, et les autres seulement leurs jours', () => {
    const reponses = [
      { reponse: 'present', jours: null },
      { reponse: 'present', jours: ['2026-06-13'] },
      { reponse: 'absent', jours: null },
      { reponse: null },
    ];
    expect(compterPresentsParJour(['2026-06-12', '2026-06-13'], reponses)).toEqual([
      { jour: '2026-06-12', presents: 1 },
      { jour: '2026-06-13', presents: 2 },
    ]);
  });
});
