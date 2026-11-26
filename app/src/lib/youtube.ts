// La vidéo d'une actu est un lien YouTube collé par le bureau. On le reconnaît sous toutes ses
// formes courantes, puis on l'enregistre toujours sous la même, celle que la base accepte
// (supabase/actus_video.sql) : l'application n'ouvre ainsi jamais autre chose que YouTube.

const HOTES_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
const IDENTIFIANT = /^[A-Za-z0-9_-]{11}$/;
const DOSSIERS_DE_VIDEO = ['shorts', 'embed', 'live', 'v'];

/** L'identifiant de la vidéo (11 caractères) d'un lien YouTube, ou null si ce n'en est pas un. */
export function identifiantYoutube(lien: string): string | null {
  const saisi = lien.trim();
  if (!saisi) return null;
  let adresse: URL;
  try {
    // Un lien recopié à la main arrive souvent sans « https:// ».
    adresse = new URL(/^https?:\/\//i.test(saisi) ? saisi : `https://${saisi}`);
  } catch {
    return null;
  }
  const hote = adresse.hostname.toLowerCase();
  const morceaux = adresse.pathname.split('/').filter(Boolean);
  let identifiant: string | null = null;
  if (hote === 'youtu.be') identifiant = morceaux[0] ?? null;
  else if (HOTES_YOUTUBE.includes(hote)) {
    identifiant = morceaux[0] === 'watch' ? adresse.searchParams.get('v') : DOSSIERS_DE_VIDEO.includes(morceaux[0]) ? (morceaux[1] ?? null) : null;
  }
  return identifiant && IDENTIFIANT.test(identifiant) ? identifiant : null;
}

/** Le lien tel qu'il est enregistré, ou null si le champ est vide ou n'est pas un lien YouTube. */
export function normaliserLienYoutube(lien: string | undefined): string | null {
  const identifiant = identifiantYoutube(lien ?? '');
  return identifiant ? `https://www.youtube.com/watch?v=${identifiant}` : null;
}

/** L'image que YouTube fournit pour une vidéo (16:9, existe pour toutes les vidéos). */
export function vignetteYoutube(identifiant: string): string {
  return `https://i.ytimg.com/vi/${identifiant}/hqdefault.jpg`;
}

/** Le message à montrer si le champ est rempli avec autre chose qu'un lien YouTube ; null si tout va bien. */
export function erreurDeLienYoutube(lien: string | undefined): string | null {
  if (!lien?.trim() || identifiantYoutube(lien)) return null;
  return 'Ce lien n’est pas une vidéo YouTube. Collez le lien de la vidéo, par exemple https://youtu.be/…';
}
