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

/** L'objet de l'e-mail : « Marché de Noël : on a besoin de vous ». */
export const sujetDeLaRelance = (titre: string) => `${titre.trim() || 'Notre prochaine action'} : on a besoin de vous`;

/** Le texte de l'e-mail : le message du bureau, puis comment s'inscrire (le lien ne peut pas ouvrir l'app). */
export function texteDeLEmail(message: string): string {
  return `${message.trim()}\n\nPour choisir votre créneau, ouvrez l’application Allianceo, onglet Agenda.\n` +
    'Vous ne l’avez pas encore ? Elle se télécharge sur l’App Store et Google Play : cherchez « Allianceo ».';
}

/** Une notification tient sur quelques lignes : au-delà, le téléphone coupe le texte. */
export const texteDeLaNotification = (message: string) => {
  const texte = message.trim().replace(/\s+/g, ' ');
  return texte.length > 180 ? `${texte.slice(0, 179)}…` : texte;
};
