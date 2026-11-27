/**
 * Vrai quand le serveur a refusé la requête parce que le jeton de connexion avait expiré.
 * Cela arrive au retour de l'arrière-plan : l'app envoie ses requêtes avant d'avoir eu le temps
 * de renouveler sa connexion, et le serveur répond 401 au lieu des actus ou des membres.
 */
export function estJetonExpire(erreur: unknown): boolean {
  if (!erreur || typeof erreur !== 'object') return false;
  const { code, message } = erreur as { code?: unknown; message?: unknown };
  if (code === 'PGRST301' || code === 'PGRST303') return true;
  return typeof message === 'string' && /jwt/i.test(message);
}

/** Combien de fois relancer une requête ratée : plus de chances quand il suffit de renouveler la connexion. */
export function doitReessayer(tentativesRatees: number, erreur: unknown): boolean {
  return tentativesRatees < (estJetonExpire(erreur) ? 3 : 1);
}
