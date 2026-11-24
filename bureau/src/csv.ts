// Un tableau exporté en CSV, lisible par Excel en français : séparateur « ; », guillemets doublés,
// et la marque UTF-8 en tête pour que les accents s'affichent.

type Cellule = string | number | null | undefined;

const echapper = (valeur: Cellule) => `"${String(valeur ?? '').replace(/"/g, '""')}"`;

/** Le texte du fichier : une ligne d'en-têtes, puis une ligne par enregistrement. */
export function texteCsv(entetes: string[], lignes: Cellule[][]): string {
  return [entetes.map(echapper), ...lignes.map((ligne) => ligne.map(echapper))].map((l) => l.join(';')).join('\n');
}

/** Fait télécharger le fichier par le navigateur. */
export function telechargerCsv(nomDuFichier: string, entetes: string[], lignes: Cellule[][]) {
  const url = URL.createObjectURL(new Blob(['﻿' + texteCsv(entetes, lignes)], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomDuFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
