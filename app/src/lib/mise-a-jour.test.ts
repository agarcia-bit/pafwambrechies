import { describe, expect, it, vi } from 'vitest';

import { ABSENCE_MIN_AVANT_VERIFICATION_MS, appliquerLaMiseAJour, doitReverifierAuRetour, type EtatDeMiseAJour, type OutilsDeMiseAJour } from './mise-a-jour';

function outils(remplacements: Partial<OutilsDeMiseAJour> = {}): OutilsDeMiseAJour {
  return {
    verifier: async () => ({ isAvailable: true }),
    telecharger: async () => ({ isNew: true }),
    recharger: vi.fn(async () => {}),
    ...remplacements,
  };
}

async function etatsAffiches(o: OutilsDeMiseAJour, delaiMs?: number) {
  const etats: EtatDeMiseAJour[] = [];
  await appliquerLaMiseAJour(o, (etat) => etats.push(etat), delaiMs);
  return etats;
}

describe('appliquerLaMiseAJour', () => {
  it('ne montre rien et ne recharge pas quand il n’y a pas de nouveauté', async () => {
    const o = outils({ verifier: async () => ({ isAvailable: false }) });
    expect(await etatsAffiches(o)).toEqual([]);
    expect(o.recharger).not.toHaveBeenCalled();
  });

  it('montre l’écran puis recharge quand une nouveauté est téléchargée', async () => {
    const o = outils();
    expect(await etatsAffiches(o)).toEqual(['en-cours']);
    expect(o.recharger).toHaveBeenCalledOnce();
  });

  it('demande de rouvrir l’app quand le rechargement échoue', async () => {
    const o = outils({ recharger: async () => { throw new Error('refus'); } });
    expect(await etatsAffiches(o)).toEqual(['en-cours', 'a-rouvrir']);
  });

  it('rend la main sans recharger quand le téléchargement échoue', async () => {
    const o = outils({ telecharger: async () => { throw new Error('réseau'); } });
    expect(await etatsAffiches(o)).toEqual(['en-cours', 'rien']);
    expect(o.recharger).not.toHaveBeenCalled();
  });

  it('rend la main quand le téléchargement dépasse le délai', async () => {
    const o = outils({ telecharger: () => new Promise(() => {}) });
    expect(await etatsAffiches(o, 20)).toEqual(['en-cours', 'rien']);
    expect(o.recharger).not.toHaveBeenCalled();
  });

  it('ne montre rien quand la vérification échoue (hors ligne)', async () => {
    const o = outils({ verifier: async () => { throw new Error('hors ligne'); } });
    expect(await etatsAffiches(o)).toEqual(['rien']);
  });
});

describe('doitReverifierAuRetour', () => {
  it('attend une vraie absence avant de revérifier', () => {
    expect(doitReverifierAuRetour(null, 5_000)).toBe(false);
    expect(doitReverifierAuRetour(0, ABSENCE_MIN_AVANT_VERIFICATION_MS - 1)).toBe(false);
    expect(doitReverifierAuRetour(0, ABSENCE_MIN_AVANT_VERIFICATION_MS)).toBe(true);
  });
});
