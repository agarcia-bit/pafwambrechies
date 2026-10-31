import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

// Valeurs publiques (identiques à l'app) : la clé publiable n'ouvre que ce que les règles RLS autorisent.
export const supabase = createClient(
  'https://ancwbfyjzaebxahtlqkm.supabase.co',
  'sb_publishable_jCDrtwqzqjbsq0NEIwUbPQ_EFeoFaDh'
);

export type Role = 'adherent' | 'bureau' | 'admin';
export type Profile = { id: string; prenom: string | null; nom: string | null; email: string | null; role: Role; tenant_id: string };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: e?.message ?? 'Erreur', loading: false })
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export const fullName = (p: { prenom?: string | null; nom?: string | null; email?: string | null }) =>
  [p.prenom, p.nom].filter(Boolean).join(' ') || p.email || '—';

export const today = () => new Date().toISOString().slice(0, 10);
export const formatDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const daysUntil = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000);

export type CotisStatus = 'a_jour' | 'expiree' | 'aucune';
export const cotisStatus = (validUntil: string | null): CotisStatus =>
  !validUntil ? 'aucune' : daysUntil(validUntil) < 0 ? 'expiree' : 'a_jour';
export const STATUS_LABEL: Record<CotisStatus, string> = { a_jour: 'À jour', expiree: 'Expirée', aucune: 'Jamais réglée' };

export function mailto(bcc: string[], subject: string, body: string) {
  return `mailto:?bcc=${bcc.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type MemberRow = {
  key: string;
  id: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  role: Role | null;
  valide_jusqu: string | null;
  inscrit: boolean;
};

/** Adhérents inscrits + adhérents importés qui n'ont pas encore de compte. */
export async function loadMembers(): Promise<MemberRow[]> {
  const [cot, inv] = await Promise.all([
    supabase.rpc('list_cotisations'),
    supabase.from('adherents_invites').select('email, prenom, nom, valide_jusqu, user_id'),
  ]);
  if (cot.error) throw cot.error;
  if (inv.error) throw inv.error;
  const joined: MemberRow[] = (cot.data as any[]).map((m) => ({
    key: m.id, id: m.id, prenom: m.prenom, nom: m.nom, email: m.email, role: m.role, valide_jusqu: m.valide_jusqu, inscrit: true,
  }));
  const waiting: MemberRow[] = (inv.data as any[])
    .filter((i) => !i.user_id)
    .map((i) => ({ key: 'i:' + i.email, id: null, prenom: i.prenom, nom: i.nom, email: i.email, role: null, valide_jusqu: i.valide_jusqu, inscrit: false }));
  return [...joined, ...waiting];
}

// ── Réglages de cotisation (montant, libellé, campagne) ─────────────────────
export type CotisConfig = { montant: string; libelle: string; url: string; ouverture: string; fin: string; module: boolean };
export async function loadCotisConfig(): Promise<CotisConfig> {
  const { data, error } = await supabase.rpc('get_my_branding');
  if (error) throw error;
  const b = (data ?? {}) as Record<string, string>;
  return {
    montant: b.cotisation_montant ?? '', libelle: b.cotisation_libelle ?? '', url: b.cotisation_url ?? '',
    ouverture: b.cotisation_ouverture ?? '', fin: b.cotisation_fin ?? '', module: b.module_cotisations === 'on',
  };
}
// ── Configuration de l'association (sections, vocabulaire, catégories) ──────
export type ModuleKey = 'annuaire' | 'offres' | 'agenda' | 'idees' | 'liens' | 'documents';
export type TenantConfig = {
  raw: Record<string, string>;
  modules: Record<ModuleKey, boolean>;
  labels: { annuaire: string; offres: string; nom: string };
  categories: { annuaire: string[]; offres: string[] };
};
export const DEFAULT_CATEGORY = 'Général';
export const parseList = (v: string | undefined) => [...new Set((v ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
export async function loadTenantConfig(): Promise<TenantConfig> {
  const { data, error } = await supabase.rpc('get_my_branding');
  if (error) throw error;
  const b = (data ?? {}) as Record<string, string>;
  const on = (v?: string) => (v ?? '').trim().toLowerCase() !== 'off';
  return {
    raw: b,
    modules: { annuaire: on(b.module_annuaire), offres: on(b.module_offres), agenda: on(b.module_agenda), idees: on(b.module_idees), liens: on(b.module_liens), documents: on(b.module_documents) },
    labels: { annuaire: b.label_annuaire?.trim() || 'Annuaire', offres: b.label_offres?.trim() || 'Offres', nom: b.label_nom?.trim() || 'Nom' },
    categories: { annuaire: parseList(b.annuaire_categories), offres: parseList(b.offres_categories) },
  };
}
export const formatRelative = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'aujourd’hui' : d === 1 ? 'hier' : d < 30 ? `il y a ${d} jours` : formatDay(iso.slice(0, 10));
};

/** Redimensionne une image dans le navigateur et l'envoie dans un bucket public, comme l'application
 *  (le nom contient les dimensions : l'app s'en sert pour le ratio d'affichage). */
export async function uploadPhoto(file: File, bucket: string, width: number, crop: boolean): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, width / bmp.width);
  let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
  if (crop) { // 4:3, centré
    if (sw / sh > 4 / 3) { sw = Math.round(sh * 4 / 3); sx = Math.round((bmp.width - sw) / 2); } else { sh = Math.round(sw * 3 / 4); sy = Math.round((bmp.height - sh) / 2); }
  }
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Image illisible');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${w}x${h}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── E-mails envoyés depuis l'espace bureau (fonction send-mail + historique) ─
export type Recipient = { email: string; user_id?: string | null };
export type SendResult = { sent: number; failed: number };

/** Dernier envoi par adresse e-mail (vide tant que l'historique n'est pas en place). */
export async function loadLastSends(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('envoi_destinataires').select('email, envois(created_at)');
  if (error) return {};
  const last: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) {
    const at = r.envois?.created_at as string | undefined;
    if (at && (!last[r.email] || at > last[r.email])) last[r.email] = at;
  }
  return last;
}

/** Envoi par la fonction send-mail ; 'not_configured' quand aucun fournisseur n'est branché. */
export async function sendMail(to: Recipient[], sujet: string, corps: string): Promise<SendResult | 'not_configured'> {
  const { data, error } = await supabase.functions.invoke('send-mail', { body: { destinataires: to, sujet, corps } });
  if (error) {
    const status = (error as any).context?.status as number | undefined;
    if (status === 501 || status === 404) return 'not_configured';
    throw new Error(error.message);
  }
  return data as SendResult;
}

export const formatDateTime = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// ── Messages de confirmation ────────────────────────────────────────────────
export const toast = (message: string, kind: 'ok' | 'error' = 'ok') =>
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, kind } }));

export function addOneYear(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + 1, m, 0).getDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// ── Pilotage du bureau (actions et tâches) ──────────────────────────────────
export const ACTION_STATUTS = ['À faire', 'En cours', 'Bloqué', 'Terminé'] as const;
export const TACHE_STATUTS = ['À faire', 'En cours', 'Terminé'] as const;
export const PRIORITES = ['Haute', 'Moyenne', 'Basse'] as const;
export type Action = { id: number; emoji: string | null; titre: string; date_action: string; referent: string | null; statut: (typeof ACTION_STATUTS)[number]; budget: number | null };
export type Tache = { id: number; action_id: number; libelle: string; responsable: string | null; echeance: string | null; statut: (typeof TACHE_STATUTS)[number]; priorite: (typeof PRIORITES)[number] };
export type BureauMember = { id: string; prenom: string | null; nom: string | null; is_bureau: boolean };

export async function loadBureau() {
  const [actions, taches, members] = await Promise.all([
    supabase.from('actions').select('id, emoji, titre, date_action, referent, statut, budget').order('date_action'),
    supabase.from('taches').select('id, action_id, libelle, responsable, echeance, statut, priorite'),
    supabase.rpc('bureau_members'),
  ]);
  if (actions.error) throw actions.error;
  if (taches.error) throw taches.error;
  if (members.error) throw members.error;
  return { actions: actions.data as Action[], taches: taches.data as Tache[], members: members.data as BureauMember[] };
}

export const isOverdue = (day: string | null, statut: string) => !!day && statut !== 'Terminé' && day < today();
export const nameOf = (members: BureauMember[], id: string | null) => {
  if (!id) return 'Non assigné';
  const m = members.find((x) => x.id === id);
  return m ? fullName(m) : 'Ancien membre';
};
export function dueLabel(day: string | null) {
  if (!day) return '';
  const d = daysUntil(day);
  return d === 0 ? 'Aujourd’hui' : d === 1 ? 'Demain' : d === -1 ? 'Hier' : formatDay(day);
}
