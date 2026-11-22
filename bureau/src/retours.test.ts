import { describe, expect, it, vi } from 'vitest';

import { appareilDuNavigateur } from './retours';

vi.mock('./lib', () => ({ supabase: {}, deposerPhoto: vi.fn() }));

describe('appareil joint à un retour de l’espace bureau', () => {
  it('reconnaît Chrome sur Mac (Chrome écrit aussi « Safari » dans son nom)', () => {
    const agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    expect(appareilDuNavigateur(agent, 1440, 900)).toEqual({ support: 'espace bureau', systeme: 'Chrome · Mac', ecran: '1440×900' });
  });

  it('reconnaît Safari sur iPhone et dit quand rien n’est reconnu', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1';
    expect(appareilDuNavigateur(iphone, 390, 844).systeme).toBe('Safari · iPhone');
    expect(appareilDuNavigateur('robot', 1, 1).systeme).toBe('Navigateur · système inconnu');
  });
});
