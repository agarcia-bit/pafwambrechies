import type { Collection, FormValues } from '@/lib/admin';

/** Ce qui empêche d'enregistrer un formulaire, dit en clair ; null quand tout est bon. */
export function erreurDuFormulaire(collection: Pick<Collection, 'fields' | 'verifier'>, valeurs: FormValues): string | null {
  const manquant = collection.fields.find((champ) => champ.required && !valeurs[champ.key]?.trim());
  if (manquant) return `Le champ « ${manquant.label} » est obligatoire.`;
  return collection.verifier?.(valeurs) ?? null;
}
