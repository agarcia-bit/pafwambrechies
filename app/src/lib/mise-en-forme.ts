// Le texte des actus, offres et commentaires est écrit à la main : *entre astérisques* il s'affiche
// en italique, **entre doubles astérisques** en gras, comme dans une messagerie. Un astérisque
// isolé (« 5 * 3 ») ou collé à une espace reste tel quel.

export type MorceauDeTexte = { texte: string; italique?: boolean; gras?: boolean };

const MISE_EN_FORME = /\*\*([^\s*](?:[^*]*[^\s*])?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*/g;

export function decouperMiseEnForme(texte: string): MorceauDeTexte[] {
  const morceaux: MorceauDeTexte[] = [];
  let depuis = 0;
  for (const trouve of texte.matchAll(MISE_EN_FORME)) {
    const debut = trouve.index ?? 0;
    if (debut > depuis) morceaux.push({ texte: texte.slice(depuis, debut) });
    morceaux.push(trouve[1] !== undefined ? { texte: trouve[1], gras: true } : { texte: trouve[2], italique: true });
    depuis = debut + trouve[0].length;
  }
  if (depuis < texte.length) morceaux.push({ texte: texte.slice(depuis) });
  return morceaux;
}
