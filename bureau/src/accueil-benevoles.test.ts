import { describe, expect, it, vi } from 'vitest';

import { phraseDesBenevoles, type ProchaineAction } from './accueil-benevoles';

vi.mock('./lib', () => ({ supabase: {}, daysUntil: () => 0 }));

const marche: ProchaineAction = { id: 1, titre: 'Marché de Noël', emoji: null, date: '2026-12-12', dansJours: 5, manque: 3, poleLePlusEnManque: 'Café' };

describe('phrase d’accueil des bénévoles', () => {
  it('dit d’abord ce qui manque à la prochaine action', () => {
    expect(phraseDesBenevoles({ prochaine: marche, aPointer: null })).toBe('« Marché de Noël » dans 5 jours : il manque 3 personnes.');
    expect(phraseDesBenevoles({ prochaine: { ...marche, dansJours: 1, manque: 1 }, aPointer: null })).toBe('« Marché de Noël » demain : il manque 1 personne.');
  });

  it('rappelle ensuite le pointage d’une action passée', () => {
    const braderie = { id: 2, titre: 'Braderie', emoji: null, date: '2026-11-20', aPointer: 4 };
    expect(phraseDesBenevoles({ prochaine: { ...marche, manque: 0 }, aPointer: braderie })).toBe('« Braderie » est passée : 4 personnes à pointer.');
  });

  it('rassure quand rien ne presse', () => {
    expect(phraseDesBenevoles({ prochaine: { ...marche, manque: 0, dansJours: 0 }, aPointer: null })).toBe('« Marché de Noël » aujourd’hui : le planning est complet.');
    expect(phraseDesBenevoles({ prochaine: null, aPointer: null })).toBe('Rien d’urgent côté bénévoles.');
  });
});
