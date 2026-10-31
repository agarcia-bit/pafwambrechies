import { useEffect, useState } from 'react';

import type { PageProps } from '../App';
import { Icon, Skeleton } from '../Icon';
import { parseList, supabase, toast, useAsync } from '../lib';

// Mêmes clés que l'écran Réglages de l'application (app_settings, une ligne par clé).
const KEYS = ['signup_code', 'tenant_name', 'tenant_tagline', 'tenant_primary_color', 'tenant_secondary_color', 'tenant_logo_url', 'tenant_login_bg_url',
  'module_annuaire', 'module_offres', 'module_agenda', 'module_idees', 'module_liens', 'module_documents',
  'label_annuaire', 'label_offres', 'label_nom', 'annuaire_categories', 'offres_categories', 'module_cotisations'] as const;
type Key = (typeof KEYS)[number];
type Settings = Record<Key, string>;
const MODULES: { key: Key; label: string; hint: string }[] = [
  { key: 'module_annuaire', label: 'Annuaire', hint: 'Les fiches des membres ou des commerces' },
  { key: 'module_offres', label: 'Offres', hint: 'Bons plans entre adhérents' },
  { key: 'module_agenda', label: 'Agenda', hint: 'Les événements et les réponses' },
  { key: 'module_idees', label: 'Boîte à idées', hint: 'Les adhérents proposent, les autres votent' },
  { key: 'module_liens', label: 'Liens utiles', hint: 'Sites et ressources' },
  { key: 'module_documents', label: 'Documents', hint: 'Les fichiers partagés' },
];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

/** Réglages de l'association (administrateurs) : identité, sections, vocabulaire, code d'accès. */
export function Reglages({ profile }: PageProps) {
  const saved = useAsync(async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', KEYS as unknown as string[]);
    if (error) throw error;
    const s = Object.fromEntries(KEYS.map((k) => [k, ''])) as Settings;
    for (const r of data as { key: Key; value: string }[]) s[r.key] = r.value ?? '';
    return s;
  }, []);
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (saved.data) setS(saved.data); }, [saved.data]);
  const set = (k: Key) => (v: string) => setS((x) => (x ? { ...x, [k]: v } : x));
  const on = (k: Key) => s![k].trim().toLowerCase() !== 'off';

  if (profile.role !== 'admin') return <p className="note">Les réglages de l’association sont réservés aux administrateurs.</p>;
  if (!s) return saved.error ? <p className="error">{saved.error}</p> : <div className="card"><Skeleton lines={8} /></div>;

  async function save() {
    setBusy(true);
    const updated_at = new Date().toISOString();
    const rows = KEYS.map((key) => ({ tenant_id: profile.tenant_id, key, value: key === 'annuaire_categories' || key === 'offres_categories' ? parseList(s![key]).join(',') : s![key].trim(), updated_at }));
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'tenant_id,key' });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Réglages enregistrés : l’app se met à jour au prochain lancement');
    saved.reload();
  }

  return (
    <div className="settings">
      <section className="card">
        <h2>Code d’accès</h2>
        <p className="muted small">Les adhérents le saisissent pour créer leur compte. Changez-le si vous pensez qu’il circule trop.</p>
        <div className="row">
          <input type="text" value={s.signup_code} onChange={(e) => set('signup_code')(e.target.value.toUpperCase())} style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '.08em', maxWidth: 200 }} aria-label="Code d’accès" />
          <button type="button" onClick={() => set('signup_code')(newCode())}><Icon name="sparkle" size={15} /> Générer</button>
        </div>
      </section>

      <section className="card">
        <h2>Identité</h2>
        <p className="muted small">Le nom, le sous-titre, la couleur et le logo apparaissent dans l’app de tous les adhérents.</p>
        <div className="form">
          <label>Nom de l’association<input type="text" value={s.tenant_name} onChange={(e) => set('tenant_name')(e.target.value)} /></label>
          <label>Sous-titre<input type="text" value={s.tenant_tagline} onChange={(e) => set('tenant_tagline')(e.target.value)} placeholder="Ex. : Les commerçants de Wambrechies" /></label>
          <div className="form-row">
            <label>Couleur principale<span className="color-field"><input type="color" value={/^#[0-9a-f]{6}$/i.test(s.tenant_primary_color) ? s.tenant_primary_color : '#4f46e5'} onChange={(e) => set('tenant_primary_color')(e.target.value)} /><input type="text" value={s.tenant_primary_color} onChange={(e) => set('tenant_primary_color')(e.target.value)} placeholder="#4F46E5" /></span></label>
            <label>Logo (adresse d’une image carrée)<input type="url" value={s.tenant_logo_url} onChange={(e) => set('tenant_logo_url')(e.target.value)} placeholder="https://" /></label>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Sections de l’app</h2>
        <p className="muted small">Désactivez ce que votre association n’utilise pas : l’onglet disparaît pour les adhérents.</p>
        <ul className="plain modules">
          {MODULES.map((m) => (
            <li key={m.key}>
              <label className="switch"><input type="checkbox" checked={on(m.key)} onChange={(e) => set(m.key)(e.target.checked ? '' : 'off')} /><span className="track" /><span><strong>{m.label}</strong><br /><span className="muted small">{m.hint}</span></span></label>
            </li>
          ))}
          <li>
            <label className="switch"><input type="checkbox" checked={s.module_cotisations.trim().toLowerCase() === 'on'} onChange={(e) => set('module_cotisations')(e.target.checked ? 'on' : '')} /><span className="track" /><span><strong>Cotisations</strong><br /><span className="muted small">Chaque adhérent voit sa situation ; montant et campagne se règlent dans « Adhérents »</span></span></label>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Vocabulaire et catégories</h2>
        <div className="form">
          <div className="form-row">
            <label>Nom de l’annuaire<input type="text" value={s.label_annuaire} onChange={(e) => set('label_annuaire')(e.target.value)} placeholder="Annuaire" /></label>
            <label>Nom des offres<input type="text" value={s.label_offres} onChange={(e) => set('label_offres')(e.target.value)} placeholder="Offres" /></label>
          </div>
          <label>Catégories de l’annuaire <span className="muted small">(séparées par des virgules, vide = aucune)</span><input type="text" value={s.annuaire_categories} onChange={(e) => set('annuaire_categories')(e.target.value)} placeholder="Commerçant, Restauration, Services" /></label>
          <label>Catégories des offres<input type="text" value={s.offres_categories} onChange={(e) => set('offres_categories')(e.target.value)} placeholder="Particulier, Professionnel" /></label>
          <label>Champ « nom » à l’inscription<input type="text" value={s.label_nom} onChange={(e) => set('label_nom')(e.target.value)} placeholder="Nom" /></label>
          <p className="muted small">Pour une association de commerçants, « Nom de l’entreprise » remplace le nom de famille à l’inscription.</p>
        </div>
      </section>

      <section className="card">
        <h2>Version web de l’association</h2>
        <p className="muted small">Utilisés seulement par l’app web publique.</p>
        <div className="form-row">
          <label>Couleur secondaire (en-tête)<input type="text" value={s.tenant_secondary_color} onChange={(e) => set('tenant_secondary_color')(e.target.value)} placeholder="#111827" /></label>
          <label>Image de fond de la connexion<input type="url" value={s.tenant_login_bg_url} onChange={(e) => set('tenant_login_bg_url')(e.target.value)} placeholder="https://" /></label>
        </div>
      </section>

      <div className="save-bar">
        <button className="primary big" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les réglages'}</button>
      </div>
    </div>
  );
}
