// Documents et liens utiles se rangent par catégorie, facultative et écrite librement par le bureau.

export type GroupeDeCategorie<T> = { titre?: string; elements: T[] };

/**
 * Regroupe par catégorie, dans l'ordre alphabétique ; ce qui n'en a pas va dans `sansCategorie`, à la fin.
 * Tant que rien n'a de catégorie, un seul groupe sans titre : l'écran reste une simple liste.
 */
export function grouperParCategorie<T extends { categorie?: string | null }>(
  elements: T[],
  sansCategorie: string
): GroupeDeCategorie<T>[] {
  if (!elements.some((e) => e.categorie?.trim())) return [{ elements }];
  const parCategorie = new Map<string, T[]>();
  for (const element of elements) {
    const categorie = element.categorie?.trim() || sansCategorie;
    parCategorie.set(categorie, [...(parCategorie.get(categorie) ?? []), element]);
  }
  return [...parCategorie]
    .sort(([a], [b]) => (a === sansCategorie ? 1 : b === sansCategorie ? -1 : a.localeCompare(b, 'fr')))
    .map(([titre, liste]) => ({ titre, elements: liste }));
}
