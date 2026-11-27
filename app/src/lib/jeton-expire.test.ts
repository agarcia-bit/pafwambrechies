import { describe, expect, it } from 'vitest';

import { doitReessayer, estJetonExpire } from './jeton-expire';

describe('estJetonExpire', () => {
  it('reconnaît le refus du serveur pour jeton expiré', () => {
    expect(estJetonExpire({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(estJetonExpire({ code: 'PGRST303', message: 'JWT expired' })).toBe(true);
    expect(estJetonExpire({ message: 'JWT expired' })).toBe(true);
  });
  it('ne confond pas avec une autre erreur', () => {
    expect(estJetonExpire({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(estJetonExpire(new Error('Network request failed'))).toBe(false);
    expect(estJetonExpire(null)).toBe(false);
  });
});

describe('doitReessayer', () => {
  it('relance jusqu’à trois fois quand le jeton a expiré', () => {
    const expire = { code: 'PGRST301', message: 'JWT expired' };
    expect(doitReessayer(2, expire)).toBe(true);
    expect(doitReessayer(3, expire)).toBe(false);
  });
  it('ne relance qu’une fois pour une autre erreur', () => {
    expect(doitReessayer(0, new Error('x'))).toBe(true);
    expect(doitReessayer(1, new Error('x'))).toBe(false);
  });
});
