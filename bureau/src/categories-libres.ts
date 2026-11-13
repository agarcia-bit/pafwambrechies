// Les catégories écrites librement (liens utiles, documents) : on propose celles déjà utilisées,
// et une saisie qui ne diffère que par la casse, les accents ou les espaces reprend l'existante,
// pour ne pas créer « matinale expert » à côté de « Matinale Expert ».

const normaliser = (categorie: string) =>
  categorie.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Les catégories déjà utilisées, sans doublon, dans l'ordre alphabétique. */
export function categoriesUtilisees(valeurs: unknown[]): string[] {
  const parCle = new Map<string, string>();
  for (const valeur of valeurs) {
    if (typeof valeur !== 'string' || !valeur.trim()) continue;
    const cle = normaliser(valeur);
    if (!parCle.has(cle)) parCle.set(cle, valeur.replace(/\s+/g, ' ').trim());
  }
  return [...parCle.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** La catégorie à enregistrer : l'existante si la saisie lui correspond, sinon la saisie nettoyée. */
export function reprendreCategorieExistante(saisie: string, existantes: string[]): string {
  const propre = saisie.replace(/\s+/g, ' ').trim();
  if (!propre) return '';
  return existantes.find((c) => normaliser(c) === normaliser(propre)) ?? propre;
}
