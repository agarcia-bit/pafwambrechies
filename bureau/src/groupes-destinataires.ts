import { cotisStatus, fullName, type MemberRow } from './lib';

// Les destinataires possibles d'un message : groupes fixes, un groupe par catégorie de l'annuaire
// (calculé, toujours à jour) et les groupes enregistrés par le bureau (supabase/groupes_envoi.sql).
// Une fiche ou une adresse qui ne mène à aucun adhérent est signalée, pour que le bureau complète l'info.

export type FicheAnnuaire = { nom_entreprise: string; categorie: string | null; email: string | null; user_id: string | null };
export type GroupeEnregistre = { id: number; nom: string; emails: string[] };
/** Un événement ou un sondage en cours qui attend une réponse, et ceux qui ont déjà répondu. */
export type AttenteDeReponse = { cle: string; libelle: string; indice: string; repondants: string[] };

export type Audience = {
  cle: string;
  libelle: string;
  indice: string;
  membres: MemberRow[];
  /** Ce qui n'a pas pu être rattaché à un adhérent, avec la raison : « Boulangerie Dupont (pas d'e-mail) ». */
  manquants: string[];
  rubrique: 'fixe' | 'attente' | 'annuaire' | 'enregistre';
  groupeId?: number;
};

const normaliser = (email: string | null | undefined) => (email ?? '').trim().toLowerCase();

/** L'adhérent d'une fiche : par son compte, sinon par son adresse e-mail. */
function adherentDeLaFiche(fiche: FicheAnnuaire, membres: MemberRow[]): MemberRow | undefined {
  if (fiche.user_id) {
    const parCompte = membres.find((m) => m.id === fiche.user_id);
    if (parCompte) return parCompte;
  }
  const email = normaliser(fiche.email);
  return email ? membres.find((m) => normaliser(m.email) === email) : undefined;
}

function raisonDeLAbsence(fiche: FicheAnnuaire): string {
  return `${fiche.nom_entreprise} (${normaliser(fiche.email) ? 'e-mail inconnu des adhérents' : "pas d'e-mail"})`;
}

/** Un groupe par catégorie de l'annuaire, dans l'ordre alphabétique. */
export function groupesDeLAnnuaire(membres: MemberRow[], fiches: FicheAnnuaire[]): Audience[] {
  const categories = [...new Set(fiches.map((f) => f.categorie?.trim()).filter((c): c is string => !!c))];
  return categories.sort((a, b) => a.localeCompare(b, 'fr')).map((categorie) => {
    const retenus = new Map<string, MemberRow>();
    const manquants: string[] = [];
    for (const fiche of fiches.filter((f) => f.categorie?.trim() === categorie)) {
      const adherent = adherentDeLaFiche(fiche, membres);
      if (adherent) retenus.set(adherent.key, adherent);
      else manquants.push(raisonDeLAbsence(fiche));
    }
    return {
      cle: `annuaire:${categorie}`,
      libelle: categorie,
      indice: "Catégorie de l'annuaire",
      membres: [...retenus.values()],
      manquants,
      rubrique: 'annuaire',
    };
  });
}

/** Les adhérents d'un groupe enregistré ; une adresse qui ne correspond plus à personne est signalée. */
export function groupeEnregistre(membres: MemberRow[], groupe: GroupeEnregistre): Audience {
  const emails = [...new Set(groupe.emails.map(normaliser).filter(Boolean))];
  const retenus = membres.filter((m) => emails.includes(normaliser(m.email)));
  const connus = new Set(retenus.map((m) => normaliser(m.email)));
  return {
    cle: `groupe:${groupe.id}`,
    libelle: groupe.nom,
    indice: 'Votre groupe',
    membres: retenus,
    manquants: emails.filter((e) => !connus.has(e)).map((e) => `${e} (n'est plus adhérent)`),
    rubrique: 'enregistre',
    groupeId: groupe.id,
  };
}

function groupesFixes(avecEmail: MemberRow[]): Audience[] {
  const fixe = (cle: string, libelle: string, indice: string, membres: MemberRow[]): Audience =>
    ({ cle, libelle, indice, membres, manquants: [], rubrique: 'fixe' });
  return [
    fixe('tous', 'Tous les adhérents', 'Toutes les personnes ayant une adresse e-mail', avecEmail),
    fixe('a_relancer', 'Cotisation à relancer', 'Cotisation expirée ou jamais réglée', avecEmail.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour')),
    fixe('non_inscrits', 'Pas encore sur l’app', 'Importés mais sans compte : pour les inviter', avecEmail.filter((m) => !m.inscrit)),
    fixe('bureau', 'Le bureau', 'Membres du bureau et administrateurs', avecEmail.filter((m) => m.role === 'bureau' || m.role === 'admin')),
  ];
}

/**
 * Pour chaque événement ou sondage en cours : les adhérents inscrits qui n'ont pas encore répondu.
 * Seuls les inscrits peuvent répondre dans l'app : les autres ne sont pas comptés.
 */
export function groupesEnAttenteDeReponse(membres: MemberRow[], attentes: AttenteDeReponse[]): Audience[] {
  const inscrits = membres.filter((m) => m.inscrit && m.id);
  return attentes.map((attente) => {
    const ontRepondu = new Set(attente.repondants);
    return {
      cle: attente.cle,
      libelle: `Pas répondu : ${attente.libelle}`,
      indice: attente.indice,
      membres: inscrits.filter((m) => !ontRepondu.has(m.id!)),
      manquants: [],
      rubrique: 'attente',
    };
  });
}

/** Toutes les audiences proposées, dans l'ordre d'affichage. */
export function construireAudiences(
  membres: MemberRow[],
  fiches: FicheAnnuaire[],
  groupes: GroupeEnregistre[],
  attentes: AttenteDeReponse[] = []
): Audience[] {
  const avecEmail = membres.filter((m) => m.email);
  return [
    ...groupesFixes(avecEmail),
    ...groupesEnAttenteDeReponse(avecEmail, attentes),
    ...groupesDeLAnnuaire(avecEmail, fiches),
    ...[...groupes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((g) => groupeEnregistre(avecEmail, g)),
  ];
}

/** Les adresses à enregistrer pour un groupe, à partir des adhérents cochés. */
export const emailsDuGroupe = (membres: MemberRow[]) => [...new Set(membres.map((m) => normaliser(m.email)).filter(Boolean))];

/** Pour la recherche dans la liste à cocher. */
export const correspondALaRecherche = (m: MemberRow, recherche: string) =>
  `${fullName(m)} ${m.email ?? ''}`.toLowerCase().includes(recherche.trim().toLowerCase());
