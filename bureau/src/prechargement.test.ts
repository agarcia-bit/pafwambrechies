import { describe, expect, it, vi } from 'vitest';

import { clearAsyncCache, prechargerDansLeCache } from './lib';

describe('prechargerDansLeCache', () => {
  it('charge une fois, puis garde le résultat pour l’onglet', async () => {
    clearAsyncCache();
    const charger = vi.fn(async () => ['Anne']);
    await prechargerDansLeCache(charger);
    await prechargerDansLeCache(charger);
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('ignore une erreur : l’onglet rechargera à son ouverture', async () => {
    clearAsyncCache();
    const enEchec = vi.fn(async () => { throw new Error('réseau'); });
    await expect(prechargerDansLeCache(enEchec)).resolves.toBeUndefined();
    await prechargerDansLeCache(enEchec);
    expect(enEchec).toHaveBeenCalledTimes(2);
  });
});
