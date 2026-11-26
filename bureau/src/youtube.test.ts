import { describe, expect, it } from 'vitest';

import { erreurDeLienYoutube, identifiantYoutube, normaliserLienYoutube, vignetteYoutube } from './youtube';

describe('identifiantYoutube', () => {
  it('reconnaît les formes courantes d’un lien YouTube', () => {
    for (const lien of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=12s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      '  youtu.be/dQw4w9WgXcQ  ',
      'www.youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(identifiantYoutube(lien), lien).toBe('dQw4w9WgXcQ');
    }
  });

  it('refuse ce qui n’est pas une vidéo YouTube', () => {
    for (const lien of [
      '',
      'bonjour',
      'https://vimeo.com/123456789',
      'https://www.youtube.com/@unechaine',
      'https://www.youtube.com/watch?v=trop-court',
      'https://youtube.com.exemple.fr/watch?v=dQw4w9WgXcQ',
      'https://exemple.fr/?lien=https://youtu.be/dQw4w9WgXcQ',
    ]) {
      expect(identifiantYoutube(lien), lien).toBeNull();
    }
  });
});

describe('normaliserLienYoutube', () => {
  it('enregistre toujours le lien sous la même forme', () => {
    expect(normaliserLienYoutube('youtu.be/dQw4w9WgXcQ?si=abc')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('rend null pour un champ vide ou un autre lien', () => {
    expect(normaliserLienYoutube('')).toBeNull();
    expect(normaliserLienYoutube(undefined)).toBeNull();
    expect(normaliserLienYoutube('https://vimeo.com/1')).toBeNull();
  });
});

describe('erreurDeLienYoutube', () => {
  it('ne dit rien quand le champ est vide ou correct', () => {
    expect(erreurDeLienYoutube('')).toBeNull();
    expect(erreurDeLienYoutube('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('explique quoi coller quand le lien n’est pas une vidéo YouTube', () => {
    expect(erreurDeLienYoutube('https://vimeo.com/1')).toContain('YouTube');
  });
});

describe('vignetteYoutube', () => {
  it('donne l’adresse de l’image de la vidéo', () => {
    expect(vignetteYoutube('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});
