import { describe, expect, it, vi } from 'vitest';

import { echangesDeLAction, texteDeLEchange, type Echange } from './echanges-creneaux';

// vi.mock est remonté avant les imports : le vrai client Supabase n'est jamais créé.
vi.mock('./supabase', () => ({ supabase: {} }));

const propose: Echange = {
  id: 1, action: 7, sens: 'propose', inscription_offerte: 9,
  offert: { pole: 'Gaufres', debut: '10:00' }, vise: { pole: 'Café', debut: '14:00' }, mon_inscription: 9,
};
const recu: Echange = { ...propose, id: 2, sens: 'recu', mon_inscription: 12 };

describe('échange de créneaux', () => {
  it('dit l’échange du point de vue de la personne, sans nommer l’autre', () => {
    expect(texteDeLEchange(propose, 120)).toBe('Vous proposez votre créneau (Gaufres, 10 h – 12 h) contre Café, 14 h – 16 h.');
    expect(texteDeLEchange(recu, 120)).toBe('Quelqu’un propose son créneau (Gaufres, 10 h – 12 h) contre le vôtre (Café, 14 h – 16 h).');
  });

  it('garde les échanges de l’action, ceux qu’on reçoit en premier', () => {
    expect(echangesDeLAction([propose, recu, { ...recu, id: 3, action: 8 }], 7).map((e) => e.id)).toEqual([2, 1]);
  });
});
