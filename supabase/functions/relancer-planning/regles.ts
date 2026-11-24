// Les règles de la relance d'un planning, sans accès à la base ni au réseau : testées à part
// (regles.test.ts), appliquées par index.ts.
//  * on prévient les membres de l'association qui ne sont pas encore inscrits sur l'action ;
//  * ceux qui ont l'app (au moins un téléphone enregistré) reçoivent une notification, les autres
//    un e-mail, comme les adhérents invités qui n'ont pas encore créé leur compte ;
//  * celui qui relance n'est pas prévenu de sa propre relance.

export type Membre = { id: string; email: string | null };
export type Appareil = { id: number; user_id: string; token: string };
export type Destinataires = { parNotification: { userId: string; appareils: Appareil[] }[]; parEmail: string[] };

const estUnEmail = (texte: string | null | undefined): texte is string => !!texte && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texte.trim());

export function destinatairesDeLaRelance(
  membres: Membre[],
  invitesSansCompte: string[],
  inscrits: Set<string>,
  appareils: Appareil[],
  quiRelance: string,
): Destinataires {
  const parNotification: Destinataires['parNotification'] = [];
  const emails = new Set<string>();
  for (const membre of membres) {
    if (membre.id === quiRelance || inscrits.has(membre.id)) continue;
    const siens = appareils.filter((a) => a.user_id === membre.id);
    if (siens.length) parNotification.push({ userId: membre.id, appareils: siens });
    else if (estUnEmail(membre.email)) emails.add(membre.email.trim().toLowerCase());
  }
  for (const email of invitesSansCompte) if (estUnEmail(email)) emails.add(email.trim().toLowerCase());
  return { parNotification, parEmail: [...emails] };
}

/**
 * L'essai « M'envoyer un essai » : seul celui qui relance est prévenu, et par les deux voies à la
 * fois (notification s'il a l'app, et e-mail), pour voir le message tel que chaque membre le recevra.
 */
export function destinatairesDeLEssai(moi: Membre | null, appareils: Appareil[]): Destinataires {
  if (!moi) return { parNotification: [], parEmail: [] };
  const siens = appareils.filter((a) => a.user_id === moi.id);
  return {
    parNotification: siens.length ? [{ userId: moi.id, appareils: siens }] : [],
    parEmail: estUnEmail(moi.email) ? [moi.email.trim().toLowerCase()] : [],
  };
}

/** Un essai se reconnaît dès l'objet ou le titre de la notification. */
export const marquerLEssai = (texte: string, essai: boolean) => (essai ? `[Essai] ${texte}` : texte);

/** L'objet de l'e-mail : « Marché de Noël : on a besoin de vous ». */
export const sujetDeLaRelance = (titre: string) => `${titre.trim() || 'Notre prochaine action'} : on a besoin de vous`;

// Les pages de l'app sur les stores (numéro App Store dans app/eas.json, nom Android dans app/app.json).
export const LIEN_APP_STORE = 'https://apps.apple.com/fr/app/id6829237313';
export const LIEN_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=fr.agalumy.allianceo';

/** Le texte de l'e-mail : le message du bureau, puis comment s'inscrire (le lien ne peut pas ouvrir l'app). */
export function texteDeLEmail(message: string): string {
  return `${message.trim()}\n\nPour choisir votre créneau, ouvrez l’application Allianceo, onglet Agenda.\n` +
    `Vous ne l’avez pas encore ? Elle se télécharge gratuitement :\n` +
    `• iPhone : ${LIEN_APP_STORE}\n• Android : ${LIEN_GOOGLE_PLAY}`;
}

/** Une notification tient sur quelques lignes : au-delà, le téléphone coupe le texte. */
export const texteDeLaNotification = (message: string) => {
  const texte = message.trim().replace(/\s+/g, ' ');
  return texte.length > 180 ? `${texte.slice(0, 179)}…` : texte;
};
