import { describe, expect, it } from 'vitest';

import { etatDOuverture, resumeDesOuvertures } from './ouvertures';

describe('resumeDesOuvertures', () => {
  it('compte les ouverts parmi les e-mails suivis, sans les échecs ni les anciens', () => {
    expect(resumeDesOuvertures([
      { statut: 'envoye', resend_id: 'a', ouvert_le: '2026-11-13T17:02:00Z' },
      { statut: 'envoye', resend_id: 'b', ouvert_le: null },
      { statut: 'echec', resend_id: null },
      { statut: 'envoye', resend_id: null },
    ])).toEqual({ ouverts: 1, suivis: 2 });
  });
});

describe('etatDOuverture', () => {
  it('donne la date d’ouverture, ou « Pas encore ouvert »', () => {
    expect(etatDOuverture({ statut: 'envoye', resend_id: 'a', ouvert_le: '2026-11-13T12:00:00Z' })).toMatch(/^Ouvert le 13 nov\. à \d{2}:00$/);
    expect(etatDOuverture({ statut: 'envoye', resend_id: 'a', ouvert_le: null })).toBe('Pas encore ouvert');
  });
  it('ne dit rien pour un e-mail non suivi ou en échec', () => {
    expect(etatDOuverture({ statut: 'envoye', resend_id: null })).toBeNull();
    expect(etatDOuverture({ statut: 'echec', resend_id: 'a' })).toBeNull();
  });
});
