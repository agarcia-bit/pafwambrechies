import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRandomBytes } from 'expo-crypto';

import type { IconName } from '@/components/ui/icon';
import { ACTU_CATEGORIES, ANNUAIRE_CATEGORIES, OFFRE_CATEGORIES } from '@/lib/categories';
import { formatDay, fullName, todayISO } from '@/lib/format';
import { uploadDirectoryPhoto, type PickedPhoto } from '@/lib/photos';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Admin screens edit the association's content. Writes are restricted to
// admins of the association by the RLS policies ("Admins … tenant …").

export type FieldType = 'text' | 'multiline' | 'url' | 'email' | 'phone' | 'choice' | 'date' | 'time' | 'photo';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
};

/** Form state: every field as a string, '' when empty. */
export type FormValues = Record<string, string>;
export type Row = { id: number } & Record<string, unknown>;

export type Collection = {
  key: 'actus' | 'offres' | 'evenements' | 'annuaire' | 'liens';
  icon: IconName;
  title: string;
  newTitle: string;
  editTitle: string;
  addLabel: string;
  empty: string;
  /** Query keys of the member screens that show this table. */
  memberQueries: string[];
  order: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  fields: Field[];
  defaults: () => FormValues;
  toValues: (row: Row) => FormValues;
  toPayload: (values: FormValues) => Record<string, unknown>;
  describe: (row: Row) => { title: string; subtitle: string; image?: string | null; flag?: string };
  /** Shown under the form when creating. */
  createHint?: string;
  /** Recomputes dependent fields after a change. */
  derive?: (changed: string, values: FormValues) => FormValues;
};

const str = (value: unknown) => (value == null ? '' : String(value));
const orNull = (value: string | undefined) => value?.trim() || null;
const pad = (time: string) => time.padStart(5, '0');

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

const actus: Collection = {
  key: 'actus',
  icon: 'newspaper',
  title: 'Actus',
  newTitle: 'Nouvelle actu',
  editTitle: 'Modifier l’actu',
  addLabel: 'Publier une actu',
  empty: 'Aucune actu publiée.',
  memberQueries: ['actus', 'actu'],
  order: [
    { column: 'date', ascending: false },
    { column: 'id', ascending: false },
  ],
  fields: [
    { key: 'titre', label: 'Titre', type: 'text', required: true },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: ACTU_CATEGORIES.slice(1) },
    { key: 'contenu', label: 'Contenu', type: 'multiline' },
  ],
  defaults: () => ({ titre: '', categorie: 'Actu Asso', contenu: '', date: todayISO() }),
  toValues: (r) => ({ titre: str(r.titre), categorie: str(r.categorie), contenu: str(r.contenu), date: str(r.date) }),
  // The date stays the publication day, as in the web app.
  toPayload: (v) => ({
    titre: v.titre.trim(),
    categorie: v.categorie,
    contenu: orNull(v.contenu),
    date: v.date || todayISO(),
  }),
  describe: (r) => ({ title: str(r.titre), subtitle: `${formatDay(str(r.date))} · ${str(r.categorie)}` }),
  createHint: 'Les adhérents qui ont activé les notifications seront prévenus dès la publication.',
};

const offres: Collection = {
  key: 'offres',
  icon: 'tag',
  title: 'Offres',
  newTitle: 'Nouvelle offre',
  editTitle: 'Modifier l’offre',
  addLabel: 'Ajouter une offre',
  empty: 'Aucune offre.',
  memberQueries: ['offres'],
  // No end date first, then the latest; expired offers end up at the bottom.
  order: [{ column: 'expiration', ascending: false, nullsFirst: true }],
  fields: [
    { key: 'commercant', label: 'Commerçant', type: 'text', required: true },
    { key: 'titre', label: 'Titre de l’offre', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'expiration', label: 'Date limite', type: 'date' },
    { key: 'tag', label: 'Étiquette', type: 'text', placeholder: '-10 %, Offert…' },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: OFFRE_CATEGORIES.slice(1) },
  ],
  defaults: () => ({ commercant: '', titre: '', description: '', expiration: '', tag: '', categorie: 'Particulier' }),
  toValues: (r) => ({
    commercant: str(r.commercant),
    titre: str(r.titre),
    description: str(r.description),
    expiration: str(r.expiration),
    tag: str(r.tag),
    categorie: str(r.categorie) || 'Particulier',
  }),
  toPayload: (v) => ({
    commercant: v.commercant.trim(),
    titre: v.titre.trim(),
    description: orNull(v.description),
    expiration: v.expiration || null,
    tag: orNull(v.tag),
    categorie: v.categorie,
  }),
  describe: (r) => ({
    title: str(r.titre),
    subtitle: [str(r.commercant), r.expiration ? `jusqu’au ${formatDay(str(r.expiration))}` : 'sans date limite'].join(' · '),
    flag: r.expiration && str(r.expiration) < todayISO() ? 'Expirée' : undefined,
  }),
};

const evenements: Collection = {
  key: 'evenements',
  icon: 'calendar',
  title: 'Agenda',
  newTitle: 'Nouvel événement',
  editTitle: 'Modifier l’événement',
  addLabel: 'Ajouter un événement',
  empty: 'Aucun événement.',
  memberQueries: ['evenements'],
  order: [{ column: 'date', ascending: false }],
  fields: [
    { key: 'titre', label: 'Titre', type: 'text', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'debut', label: 'Début', type: 'time' },
    { key: 'fin', label: 'Fin', type: 'time' },
    { key: 'lieu', label: 'Lieu', type: 'text', placeholder: 'Ex : Salle des fêtes' },
    { key: 'description', label: 'Description', type: 'multiline' },
  ],
  defaults: () => ({ titre: '', date: todayISO(), debut: '09:00', fin: '10:00', lieu: '', description: '' }),
  // "heure" is stored as text: "09:00 – 10:00", like the web app does.
  toValues: (r) => {
    const [debut = '09:00', fin = '10:00'] = str(r.heure).match(/\d{1,2}:\d{2}/g) ?? [];
    return {
      titre: str(r.titre),
      date: str(r.date),
      debut: pad(debut),
      fin: pad(fin),
      lieu: str(r.lieu),
      description: str(r.description),
    };
  },
  toPayload: (v) => ({
    titre: v.titre.trim(),
    date: v.date,
    heure: v.debut && v.fin ? `${v.debut} – ${v.fin}` : v.debut || v.fin || null,
    lieu: orNull(v.lieu),
    description: orNull(v.description),
  }),
  derive: (changed, v) => (changed === 'debut' ? { ...v, fin: addOneHour(v.debut) } : v),
  describe: (r) => ({
    title: str(r.titre),
    subtitle: [formatDay(str(r.date)), str(r.heure), str(r.lieu)].filter(Boolean).join(' · '),
    flag: str(r.date) < todayISO() ? 'Passé' : undefined,
  }),
};

const annuaire: Collection = {
  key: 'annuaire',
  icon: 'people',
  title: 'Annuaire',
  newTitle: 'Nouveau commerçant',
  editTitle: 'Modifier la fiche',
  addLabel: 'Ajouter un commerçant',
  empty: 'Aucun commerçant.',
  memberQueries: ['annuaire'],
  order: [{ column: 'nom_entreprise', ascending: true }],
  fields: [
    { key: 'photo_url', label: 'Photo', type: 'photo' },
    { key: 'nom_entreprise', label: 'Nom de l’entreprise', type: 'text', required: true },
    { key: 'prenom_contact', label: 'Prénom du contact', type: 'text' },
    { key: 'nom_contact', label: 'Nom du contact', type: 'text' },
    { key: 'categorie', label: 'Catégorie', type: 'choice', required: true, options: ANNUAIRE_CATEGORIES.slice(1) },
    { key: 'adresse', label: 'Adresse', type: 'text' },
    { key: 'telephone', label: 'Téléphone', type: 'phone' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'linkedin.com/in/…' },
    { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@compte' },
    { key: 'description', label: 'Description', type: 'multiline' },
  ],
  defaults: () => ({ categorie: 'Commerçant' }),
  toValues: (r) =>
    Object.fromEntries(annuaire.fields.map((f) => [f.key, str(r[f.key])])) as FormValues,
  toPayload: (v) => ({
    nom_entreprise: v.nom_entreprise.trim(),
    prenom_contact: orNull(v.prenom_contact),
    nom_contact: orNull(v.nom_contact),
    categorie: v.categorie,
    adresse: orNull(v.adresse),
    telephone: orNull(v.telephone),
    email: orNull(v.email),
    linkedin: orNull(v.linkedin),
    instagram: orNull(v.instagram),
    description: orNull(v.description),
    photo_url: orNull(v.photo_url),
  }),
  describe: (r) => ({
    title: str(r.nom_entreprise),
    subtitle: [fullName(str(r.prenom_contact), str(r.nom_contact)), str(r.categorie)].filter(Boolean).join(' · '),
    image: r.photo_url ? str(r.photo_url) : null,
  }),
};

const liens: Collection = {
  key: 'liens',
  icon: 'link',
  title: 'Liens utiles',
  newTitle: 'Nouveau lien',
  editTitle: 'Modifier le lien',
  addLabel: 'Ajouter un lien',
  empty: 'Aucun lien.',
  memberQueries: ['liens'],
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

export const COLLECTIONS = { actus, offres, evenements, annuaire, liens } satisfies Record<Collection['key'], Collection>;

export function findCollection(key: string | undefined): Collection | undefined {
  return key && key in COLLECTIONS ? COLLECTIONS[key as Collection['key']] : undefined;
}

// An update or delete that RLS filters out returns no error, only no rows.
class NotAllowedError extends Error {}

export function adminErrorMessage(error: unknown): string {
  if (error instanceof NotAllowedError || (error as { code?: string })?.code === '42501') {
    return 'Action réservée aux administrateurs de l’association.';
  }
  if (/network|fetch/i.test((error as Error)?.message ?? '')) return 'Pas de connexion internet. Réessayez.';
  return 'Enregistrement impossible. Réessayez.';
}

function useRefresh(keys: string[][]) {
  const client = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useAdminList(c: Collection) {
  return useQuery({
    queryKey: ['admin', c.key],
    queryFn: async () => {
      let query = supabase.from(c.key).select('*');
      for (const o of c.order) query = query.order(o.column, { ascending: o.ascending, nullsFirst: o.nullsFirst });
      const { data, error } = await query;
      if (error) throw error;
      return data as Row[];
    },
  });
}

export function useSaveItem(c: Collection) {
  const { profile } = useMember();
  const refresh = useRefresh([['admin', c.key], ...c.memberQueries.map((k) => [k])]);
  return useMutation({
    mutationFn: async ({ id, values, photo }: { id?: number; values: FormValues; photo?: PickedPhoto | null }) => {
      const payload = c.toPayload(values);
      if (photo) payload.photo_url = await uploadDirectoryPhoto(photo);
      if (id) {
        const { data, error } = await supabase.from(c.key).update(payload).eq('id', id).select('id');
        if (error) throw error;
        if (!data.length) throw new NotAllowedError();
      } else {
        const { error } = await supabase.from(c.key).insert({ ...payload, tenant_id: profile.tenant_id });
        if (error) throw error;
      }
    },
    onSuccess: refresh,
  });
}

export function useDeleteItem(c: Collection) {
  const refresh = useRefresh([['admin', c.key], ...c.memberQueries.map((k) => [k])]);
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.from(c.key).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new NotAllowedError();
    },
    onSuccess: refresh,
  });
}

// ── Ideas moderation ─────────────────────────────────────────────────────────

export type IdeeRow = { id: number; titre: string | null; texte: string; prenom: string | null; created_at: string };

export function useAdminIdees() {
  return useQuery({
    queryKey: ['admin', 'idees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('idees')
        .select('id, titre, texte, prenom, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as IdeeRow[];
    },
  });
}

export function useDeleteIdee() {
  const refresh = useRefresh([['admin', 'idees'], ['idees'], ['idee']]);
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.from('idees').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new NotAllowedError();
    },
    onSuccess: refresh,
  });
}

// ── Association settings ─────────────────────────────────────────────────────

export const SETTING_KEYS = [
  'signup_code',
  'tenant_name',
  'tenant_tagline',
  'tenant_primary_color',
  'tenant_secondary_color',
  'tenant_logo_url',
  'tenant_login_bg_url',
] as const;
export type Settings = Record<(typeof SETTING_KEYS)[number], string>;

export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value').in('key', SETTING_KEYS);
      if (error) throw error;
      const settings = Object.fromEntries(SETTING_KEYS.map((key) => [key, ''])) as Settings;
      for (const { key, value } of data as { key: keyof Settings; value: string }[]) settings[key] = value ?? '';
      return settings;
    },
  });
}

export function useSaveSettings() {
  const { profile } = useMember();
  // The membership query carries the branding: the app re-themes right away.
  const refresh = useRefresh([['admin', 'settings'], ['membership']]);
  return useMutation({
    mutationFn: async (settings: Settings) => {
      const updatedAt = new Date().toISOString();
      const rows = SETTING_KEYS.map((key) => ({
        tenant_id: profile.tenant_id,
        key,
        value: settings[key].trim(),
        updated_at: updatedAt,
      }));
      const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'tenant_id,key' });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

// 32 characters without look-alikes (0/O, 1/I): 256 is a multiple of 32, so
// the modulo keeps every character equally likely.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random access code: codes can be tried without an account, they must not be guessable. */
export function generateSignupCode(length = 8): string {
  return Array.from(getRandomBytes(length), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
