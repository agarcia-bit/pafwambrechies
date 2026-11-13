import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib', () => ({ supabase: {}, fullName: (p: { prenom?: string | null; email?: string | null }) => p.prenom || p.email || '—' }));

import { candidatsCollegues, type Collegue } from './collegues';
import type { MemberRow } from './lib';

const membre = (prenom: string, email: string | null): MemberRow =>
  ({ key: prenom, id: prenom, prenom, nom: null, email, role: 'adherent', valide_jusqu: null, inscrit: true });

describe('candidatsCollegues', () => {
  it('écarte le titulaire, les collègues déjà rattachés et ceux sans adresse, et trie par nom', () => {
    const collegues: Collegue[] = [{ fiche_id: 1, email: 'bea@ex.fr', user_id: null, prenom: 'Béa', nom: null }];
    const candidats = candidatsCollegues(
      [membre('Zoé', 'zoe@ex.fr'), membre('Titulaire', 'Patron@Ex.fr'), membre('Béa', 'bea@ex.fr'), membre('Sans', null), membre('Alain', 'alain@ex.fr')],
      collegues,
      'patron@ex.fr'
    );
    expect(candidats.map((m) => m.prenom)).toEqual(['Alain', 'Zoé']);
  });
});
