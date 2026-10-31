import { DEFAULT_CATEGORY, formatDay, today, type TenantConfig } from './lib';

// Les contenus de l'application (actus, offres, annuaire, liens), décrits une fois pour
// toutes : même liste de champs et même format d'enregistrement que l'écran admin de l'app.

export type FieldType = 'text' | 'multiline' | 'url' | 'email' | 'phone' | 'choice' | 'date' | 'photo';
export type Field = { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string; options?: readonly string[]; labels?: Record<string, string>; half?: boolean };
export type Values = Record<string, string>;
export type Row = { id: number } & Record<string, unknown>;

export type Collection = {
  key: 'actus' | 'offres' | 'annuaire' | 'liens';
  title: string;
  newTitle: string;
  addLabel: string;
  empty: string;
  order: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  fields: Field[];
  defaults: () => Values;
  toValues: (row: Row) => Values;
  toPayload: (values: Values) => Record<string, unknown>;
  describe: (row: Row) => { title: string; subtitle: string; image?: string | null; flag?: string; flagTone?: string };
  photo?: { key: string; bucket: string; width: number; crop: boolean };
  createHint?: string;
};

const str = (v: unknown) => (v == null ? '' : String(v));
const orNull = (v: string | undefined) => v?.trim() || null;
export const ACTU_CATEGORIES = ['Actu Asso', 'Infos pratiques', 'Événement', 'Membres'] as const;

const actus: Collection = {
  key: 'actus', title: 'Actus', newTitle: 'Nouvelle actu', addLabel: 'Publier une actu', empty: 'Aucune actu publiée.',
  order: [{ column: 'date', ascending: false }, { column: 'id', ascending: false }],
  fields: [
    { key: 'titre', label: 'Titre', type: 'text', required: true },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: ACTU_CATEGORIES, half: true },
    { key: 'date_evenement', label: 'Date de l’événement (facultatif)', type: 'date', half: true },
    { key: 'contenu', label: 'Contenu', type: 'multiline' },
    { key: 'image_url', label: 'Photo', type: 'photo' },
  ],
  photo: { key: 'image_url', bucket: 'actus-photos', width: 1200, crop: false },
  defaults: () => ({ titre: '', categorie: 'Actu Asso', date_evenement: '', contenu: '', date: today(), image_url: '' }),
  toValues: (r) => ({ titre: str(r.titre), categorie: str(r.categorie), date_evenement: str(r.date_evenement), contenu: str(r.contenu), date: str(r.date), image_url: str(r.image_url) }),
  // La date reste le jour de publication.
  toPayload: (v) => ({ titre: v.titre.trim(), categorie: v.categorie, date_evenement: orNull(v.date_evenement), contenu: orNull(v.contenu), date: v.date || today(), image_url: orNull(v.image_url) }),
  describe: (r) => ({ title: str(r.titre), subtitle: `${formatDay(str(r.date))} · ${str(r.categorie)}`, image: r.image_url ? str(r.image_url) : undefined }),
  createHint: 'Les adhérents qui ont activé les notifications seront prévenus dès la publication.',
};

const offres: Collection = {
  key: 'offres', title: 'Offres', newTitle: 'Nouvelle offre', addLabel: 'Ajouter une offre', empty: 'Aucune offre.',
  order: [{ column: 'expiration', ascending: false, nullsFirst: true }],
  fields: [
    { key: 'commercant', label: 'Proposé par', type: 'text', required: true },
    { key: 'titre', label: 'Titre de l’offre', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'expiration', label: 'Date limite', type: 'date', half: true },
    { key: 'tag', label: 'Étiquette', type: 'text', placeholder: '-10 %, Offert…', half: true },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: [], half: true },
    { key: 'statut', label: 'Statut', type: 'choice', options: ['publiee', 'en_attente'], labels: { publiee: 'Publiée', en_attente: 'En attente de validation' }, half: true },
  ],
  defaults: () => ({ commercant: '', titre: '', description: '', expiration: '', tag: '', categorie: DEFAULT_CATEGORY, statut: 'publiee' }),
  toValues: (r) => ({ commercant: str(r.commercant), titre: str(r.titre), description: str(r.description), expiration: str(r.expiration), tag: str(r.tag), categorie: str(r.categorie) || DEFAULT_CATEGORY, statut: str(r.statut) }),
  toPayload: (v) => ({ ...(v.statut ? { statut: v.statut } : {}), commercant: v.commercant.trim(), titre: v.titre.trim(), description: orNull(v.description), expiration: v.expiration || null, tag: orNull(v.tag), categorie: v.categorie }),
  describe: (r) => ({
    title: str(r.titre),
    subtitle: [str(r.commercant), r.expiration ? `jusqu’au ${formatDay(str(r.expiration))}` : 'sans date limite'].join(' · '),
    flag: r.statut === 'en_attente' ? 'À valider' : r.expiration && str(r.expiration) < today() ? 'Expirée' : undefined,
    flagTone: r.statut === 'en_attente' ? 'warn' : 'neutral',
  }),
};

const annuaire: Collection = {
  key: 'annuaire', title: 'Annuaire', newTitle: 'Nouvelle fiche', addLabel: 'Ajouter une fiche', empty: 'Aucune fiche.',
  order: [{ column: 'nom_entreprise', ascending: true }],
  photo: { key: 'photo_url', bucket: 'annuaire-photos', width: 800, crop: true },
  fields: [
    { key: 'nom_entreprise', label: 'Nom', type: 'text', required: true },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: [] },
    { key: 'prenom_contact', label: 'Prénom du contact', type: 'text', half: true },
    { key: 'nom_contact', label: 'Nom du contact', type: 'text', half: true },
    { key: 'adresse', label: 'Adresse', type: 'text' },
    { key: 'telephone', label: 'Téléphone', type: 'phone', half: true },
    { key: 'email', label: 'E-mail', type: 'email', half: true },
    { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'linkedin.com/in/…', half: true },
    { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@compte', half: true },
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'photo_url', label: 'Photo', type: 'photo' },
  ],
  defaults: () => ({ categorie: DEFAULT_CATEGORY }),
  toValues: (r) => Object.fromEntries(annuaire.fields.map((f) => [f.key, str(r[f.key])])) as Values,
  toPayload: (v) => ({
    nom_entreprise: v.nom_entreprise.trim(), prenom_contact: orNull(v.prenom_contact), nom_contact: orNull(v.nom_contact), categorie: v.categorie,
    adresse: orNull(v.adresse), telephone: orNull(v.telephone), email: orNull(v.email), linkedin: orNull(v.linkedin), instagram: orNull(v.instagram),
    description: orNull(v.description), photo_url: orNull(v.photo_url),
  }),
  describe: (r) => ({ title: str(r.nom_entreprise), subtitle: [[str(r.prenom_contact), str(r.nom_contact)].filter(Boolean).join(' '), str(r.categorie)].filter(Boolean).join(' · '), image: r.photo_url ? str(r.photo_url) : null }),
};

const liens: Collection = {
  key: 'liens', title: 'Liens utiles', newTitle: 'Nouveau lien', addLabel: 'Ajouter un lien', empty: 'Aucun lien.',
  order: [{ column: 'created_at', ascending: true }],
  fields: [
    { key: 'titre', label: 'Titre', type: 'text', required: true },
    { key: 'url', label: 'Adresse du site', type: 'url', required: true, placeholder: 'https://…' },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  defaults: () => ({ titre: '', url: '', description: '' }),
  toValues: (r) => ({ titre: str(r.titre), url: str(r.url), description: str(r.description) }),
  toPayload: (v) => ({ titre: v.titre.trim(), url: v.url.trim(), description: orNull(v.description) }),
  describe: (r) => ({ title: str(r.titre), subtitle: str(r.url) }),
};

export const COLLECTIONS = { actus, offres, annuaire, liens } as const;

/** La collection telle que l'association la nomme, avec ses catégories (sans catégories, le champ disparaît). */
export function withConfig(c: Collection, config: TenantConfig): Collection {
  if (c.key !== 'annuaire' && c.key !== 'offres') return c;
  const categories = config.categories[c.key];
  const fields = c.fields.flatMap((f) => (f.key !== 'categorie' ? [f] : categories.length ? [{ ...f, options: categories }] : []));
  const defaults = () => ({ ...c.defaults(), categorie: categories[0] ?? DEFAULT_CATEGORY });
  return { ...c, title: config.labels[c.key], fields, defaults };
}
