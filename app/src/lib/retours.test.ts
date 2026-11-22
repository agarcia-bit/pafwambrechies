import { describe, expect, it, vi } from 'vitest';

import { appareilDuRetour } from './retours';

// vi.mock remonte avant les imports : le module se charge sans les vraies bibliothèques natives.
vi.mock('expo-constants', () => ({ default: {} }));
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 0, height: 0 }) }, Platform: { OS: 'ios', Version: '18' } }));
vi.mock('@/lib/photos', () => ({ deposerPhoto: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));


describe('appareil joint à un retour', () => {
  it('nomme le système, la version et la taille d’écran arrondie', () => {
    expect(appareilDuRetour('ios', '18.1', '1.0.0', 390.4, 844)).toEqual({ support: 'app', systeme: 'iOS 18.1', version: '1.0.0', ecran: '390×844' });
  });

  it('dit « inconnue » quand la version de l’app manque', () => {
    expect(appareilDuRetour('android', 34, null, 412, 915)).toEqual({ support: 'app', systeme: 'Android 34', version: 'inconnue', ecran: '412×915' });
  });
});
