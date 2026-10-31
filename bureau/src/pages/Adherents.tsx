import { useEffect, useMemo, useState } from 'react';

import { Compose } from '../Compose';
import { Drawer as Panel } from '../Drawer';
import { Avatar, Empty, Icon, Skeleton } from '../Icon';
import {
  addOneYear, cotisStatus, euros, formatDateTime, formatDay, fullName, loadCotisConfig, loadLastSends, loadMembers, STATUS_LABEL, supabase,
  today, toast, useAsync, type CotisConfig, type MemberRow, type Recipient,
} from '../lib';

type Filter = 'tous' | 'a_relancer' | 'non_inscrits';
type SortKey = 'nom' | 'cotisation';
const PAGE = 50;

const asRecipient = (m: MemberRow): Recipient => ({ email: m.email!, user_id: m.id });

export function Adherents() {
  const members = useAsync(loadMembers, []);
  const config = useAsync(loadCotisConfig, []);
  const sends = useAsync(loadLastSends, []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'nom', dir: 1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [compose, setCompose] = useState<Recipient[] | null>(null);
  const [settings, setSettings] = useState(false);
  const [bulkDate, setBulkDate] = useState(addOneYear(today()));
  const [busy, setBusy] = useState(false);

  // Un lien « À relancer » de la vue d'ensemble arrive avec ?filtre=a_relancer
  useEffect(() => {
    const f = new URLSearchParams(location.hash.split('?')[1] ?? '').get('filtre');
    if (f === 'a_relancer' || f === 'non_inscrits') setFilter(f);
  }, []);
  useEffect(() => setPage(0), [q, filter, sort]);
  // La date proposée pour le pointage suit la campagne en cours.
  useEffect(() => { if (config.data?.fin) setBulkDate(config.data.fin); }, [config.data?.fin]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (members.data ?? []).filter((m) => {
      if (filter === 'a_relancer' && cotisStatus(m.valide_jusqu) === 'a_jour') return false;
      if (filter === 'non_inscrits' && m.inscrit) return false;
      return !needle || `${fullName(m)} ${m.email ?? ''}`.toLowerCase().includes(needle);
    });
    return list.sort((a, b) => {
      const va = sort.key === 'nom' ? fullName(a).toLowerCase() : a.valide_jusqu ?? '';
      const vb = sort.key === 'nom' ? fullName(b).toLowerCase() : b.valide_jusqu ?? '';
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0;
    });
  }, [members.data, q, filter, sort]);

  if (members.loading && !members.data) return <div className="card"><Skeleton lines={8} /></div>;
  if (members.error) return <p className="error">{members.error}</p>;

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const chosen = rows.filter((m) => picked.has(m.key));
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');
  const all = members.data!;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, (page + 1) * PAGE);
  const current = open ? all.find((m) => m.key === open) ?? null : null;
  const last = sends.data ?? {};

  const upToDate = all.filter((m) => cotisStatus(m.valide_jusqu) === 'a_jour');
  const montant = Number((config.data?.montant ?? '').replace(',', '.')) || 0;

  function exportCsv() {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Prénom', 'Nom', 'E-mail', 'Cotisation jusqu’au', 'Inscrit', 'Dernière relance'].join(';'),
      ...rows.map((m) => [esc(m.prenom), esc(m.nom), esc(m.email), esc(m.valide_jusqu), esc(m.inscrit ? 'oui' : 'non'), esc(m.email && last[m.email] ? last[m.email].slice(0, 10) : '')].join(';'))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `adherents-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Pointage groupé : une cotisation par personne choisie, même date pour tous.
  async function markPaid() {
    if (!bulkDate || !chosen.length) return;
    if (!confirm(`Enregistrer la cotisation de ${chosen.length} adhérent${chosen.length > 1 ? 's' : ''} jusqu’au ${formatDay(bulkDate)} ?`)) return;
    setBusy(true);
    let ok = 0;
    const waiting = chosen.filter((m) => !m.id && m.email).map((m) => ({ prenom: m.prenom ?? '', nom: m.nom ?? '', email: m.email, valide_jusqu: bulkDate }));
    for (const m of chosen.filter((m) => m.id)) {
      const { error } = await supabase.rpc('set_cotisation', { p_member: m.id, p_valide_jusqu: bulkDate });
      if (!error) ok++;
    }
    if (waiting.length) {
      const { error } = await supabase.rpc('importer_adherents', { p_rows: waiting });
      if (!error) ok += waiting.length;
    }
    setBusy(false);
    toast(ok === chosen.length ? `${ok} cotisation${ok > 1 ? 's' : ''} enregistrée${ok > 1 ? 's' : ''}` : `${ok} sur ${chosen.length} enregistrée(s)`, ok === chosen.length ? 'ok' : 'error');
    setPicked(new Set());
    members.reload();
  }

  return (
    <>
      <div className="kpis">
        <Kpi value={all.length} label="adhérents" />
        <Kpi value={upToDate.length} label="à jour" tone="ok" />
        <Kpi value={all.length - upToDate.length} label="à relancer" tone={all.length - upToDate.length ? 'warn' : 'ok'} />
        {montant > 0 && <Kpi value={euros(montant)} label={`cotisation${config.data?.libelle ? ' ' + config.data.libelle : ''}`} />}
        {montant > 0 && <Kpi value={euros(upToDate.length * montant)} label="encaissé (à jour × montant)" tone="brand" />}
        {montant > 0 && all.length - upToDate.length > 0 && <Kpi value={euros((all.length - upToDate.length) * montant)} label="à encaisser" tone="warn" />}
        <button className="kpi kpi-btn" onClick={() => setSettings(true)} title="Montant, libellé, campagne de renouvellement">
          <Icon name="edit" size={16} /><span>{montant > 0 ? 'Réglages' : 'Définir le montant'}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="search"><Icon name="search" size={16} /><input type="search" placeholder="Rechercher un nom ou un e-mail" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">
          {([['tous', `Tous (${all.length})`], ['a_relancer', `À relancer (${all.length - upToDate.length})`], ['non_inscrits', `Pas inscrits (${all.filter((m) => !m.inscrit).length})`]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="push ghost" onClick={exportCsv}><Icon name="download" size={15} /> Exporter en CSV</button>
      </div>

      {chosen.length > 0 && (
        <div className="bar">
          <span>{chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}</span>
          <span className="row" style={{ margin: 0 }}>
            <span className="inline-field">
              <span className="muted small">Payé jusqu’au</span>
              <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} aria-label="Payé jusqu’au" />
              <button className="primary" disabled={busy || !bulkDate} onClick={markPaid}><Icon name="check" size={15} /> Marquer payé</button>
            </span>
            <button disabled={!chosen.some((m) => m.email)} onClick={() => setCompose(chosen.filter((m) => m.email).map(asRecipient))}><Icon name="mail" size={15} /> Écrire</button>
            <button className="link" onClick={() => setPicked(new Set())}>Tout désélectionner</button>
          </span>
        </div>
      )}

      <div className="card flush">
        <table className="clickable">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Tout sélectionner" checked={shown.length > 0 && shown.every((m) => picked.has(m.key))} onChange={(e) => setPicked((s) => { const n = new Set(s); shown.forEach((m) => (e.target.checked ? n.add(m.key) : n.delete(m.key))); return n; })} /></th>
              <th className="sortable" onClick={() => sortBy('nom')}>Adhérent{arrow('nom')}</th>
              <th>E-mail</th>
              <th className="sortable" onClick={() => sortBy('cotisation')}>Cotisation{arrow('cotisation')}</th>
              <th>Dernière relance</th>
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const status = cotisStatus(m.valide_jusqu);
              return (
                <tr key={m.key} onClick={() => setOpen(m.key)} className={m.key === open ? 'sel' : ''}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${fullName(m)}`} checked={picked.has(m.key)} onChange={() => toggle(m.key)} /></td>
                  <td><span className="who"><Avatar name={fullName(m)} />{fullName(m)}{m.role && m.role !== 'adherent' && <span className="tag">{m.role}</span>}</span></td>
                  <td className="muted">{m.email}</td>
                  <td><span className={'badge ' + status}>{STATUS_LABEL[status]}</span>{m.valide_jusqu && <span className="muted"> {formatDay(m.valide_jusqu)}</span>}</td>
                  <td className="muted">{m.email && last[m.email] ? formatDateTime(last[m.email]) : '—'}</td>
                  <td>{m.inscrit ? <span className="badge ok">Inscrit</span> : <span className="badge neutral">En attente</span>}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="empty"><Empty icon="search" title="Aucun adhérent ne correspond" hint="Essayez un autre nom ou retirez le filtre." /></td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>← Précédent</button>
          <span className="muted">Page {page + 1} sur {pages} · {rows.length} adhérents</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant →</button>
        </div>
      )}

      {current && (
        <MemberDrawer m={current} config={config.data} lastSend={current.email ? last[current.email] : undefined}
          onClose={() => setOpen(null)} onChanged={() => members.reload()} onWrite={() => current.email && setCompose([asRecipient(current)])} />
      )}
      {compose && <Compose to={compose} onClose={() => setCompose(null)} onSent={() => sends.reload()} />}
      {settings && <SettingsDrawer config={config.data} onClose={() => setSettings(false)} onChanged={() => config.reload()} />}
    </>
  );
}

function Kpi({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return <div className={'kpi ' + (tone ?? '')}><strong>{value}</strong><span>{label}</span></div>;
}

// ── Fiche d'un adhérent ──────────────────────────────────────────────────────

function MemberDrawer({ m, config, lastSend, onClose, onChanged, onWrite }: {
  m: MemberRow; config?: CotisConfig; lastSend?: string; onClose: () => void; onChanged: () => void; onWrite: () => void;
}) {
  const suggested = () => (m.valide_jusqu && cotisStatus(m.valide_jusqu) === 'a_jour' ? m.valide_jusqu : config?.fin || addOneYear(today()));
  const [date, setDate] = useState(suggested);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDate(suggested()), [m.key, m.valide_jusqu, config?.fin]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = cotisStatus(m.valide_jusqu);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(ok);
    onChanged();
  }

  const save = () =>
    m.id
      ? run(() => supabase.rpc('set_cotisation', { p_member: m.id, p_valide_jusqu: date }), 'Cotisation enregistrée')
      : run(() => supabase.rpc('importer_adherents', { p_rows: [{ prenom: m.prenom ?? '', nom: m.nom ?? '', email: m.email, valide_jusqu: date }] }), 'Cotisation enregistrée');
  const clear = () => run(() => supabase.rpc('clear_cotisation', { p_member: m.id }), 'Cotisation effacée');
  const removeInvite = () => {
    if (!confirm(`Retirer ${fullName(m)} de la liste des adhérents à inviter ?`)) return;
    run(() => supabase.rpc('retirer_invitation', { p_email: m.email }), 'Adhérent retiré').then(onClose);
  };

  return (
    <Panel title={fullName(m)} subtitle={m.email ?? undefined} onClose={onClose}
      footer={<>{!m.inscrit && <button className="link danger" disabled={busy} onClick={removeInvite}>Retirer de la liste</button>}<span className="grow" /><button onClick={onClose}>Fermer</button></>}>
      <p>
        {m.inscrit ? <span className="badge ok">Inscrit sur l’app</span> : <span className="badge neutral">Pas encore inscrit</span>}
        {m.role && m.role !== 'adherent' && <span className="tag">{m.role}</span>}
        {lastSend && <span className="muted small"> · relancé le {formatDateTime(lastSend)}</span>}
      </p>
      <h3 className="sect">Cotisation</h3>
      <p><span className={'badge ' + status}>{STATUS_LABEL[status]}</span>{m.valide_jusqu && <span className="muted"> jusqu’au {formatDay(m.valide_jusqu)}</span>}</p>
      <div className="form">
        <label>Valable jusqu’au<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="primary" disabled={busy || !date} onClick={save}>{status === 'a_jour' ? 'Mettre à jour' : 'Enregistrer le renouvellement'}</button>
          {m.id && m.valide_jusqu && <button className="link danger" disabled={busy} onClick={clear}>Effacer</button>}
        </div>
      </div>
      <p className="muted small">
        {config?.fin ? `Date proposée : fin de la campagne ${config.libelle || ''}.` : 'La date proposée est à 12 mois.'}
        {config?.montant ? ` Montant : ${config.montant} €.` : ''} Le paiement lui-même se fait hors de l’app{config?.url ? ' (' : ''}{config?.url && <a href={config.url} target="_blank" rel="noreferrer">page de règlement</a>}{config?.url ? ')' : ''}.
      </p>
      {m.email && <p><button onClick={onWrite}><Icon name="mail" size={16} /> Écrire à cette personne</button></p>}
    </Panel>
  );
}

// ── Montant, libellé et campagne de renouvellement ───────────────────────────

function SettingsDrawer({ config, onClose, onChanged }: { config?: CotisConfig; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({ montant: config?.montant ?? '', libelle: config?.libelle ?? '', url: config?.url ?? '', ouverture: config?.ouverture ?? '', fin: config?.fin ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  async function save() {
    if ((f.ouverture && !f.fin) || (!f.ouverture && f.fin)) return toast('Indiquez le début et la fin de la campagne, ou aucun des deux.', 'error');
    setBusy(true);
    const { error } = await supabase.rpc('save_cotisation_settings', { p_url: f.url, p_montant: f.montant, p_libelle: f.libelle, p_ouverture: f.ouverture || null, p_fin: f.fin || null });
    setBusy(false);
    if (error) return toast(error.message.includes('invalid_url') ? 'L’adresse de paiement doit commencer par https://' : error.message, 'error');
    toast('Réglages enregistrés');
    onChanged();
    onClose();
  }
  return (
    <Panel title="Cotisation" subtitle="Ces réglages sont partagés avec l’application." onClose={onClose}
      footer={<><button onClick={onClose} disabled={busy}>Annuler</button><span className="grow" /><button className="primary" onClick={save} disabled={busy}>Enregistrer</button></>}>
      <div className="form">
        <div className="form-row">
          <label>Montant (€)<input type="text" inputMode="decimal" value={f.montant} onChange={(e) => set('montant', e.target.value)} placeholder="Ex. : 50" /></label>
          <label>Libellé<input type="text" value={f.libelle} onChange={(e) => set('libelle', e.target.value)} placeholder="Ex. : 2027" /></label>
        </div>
        <label>Page de paiement (HelloAsso…)<input type="url" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" /></label>
        <h3 className="sect">Campagne de renouvellement</h3>
        <p className="muted small">Pendant la campagne, les adhérents dont la cotisation se termine avant la date de fin sont invités à renouveler dans l’application (bandeau et rappel hebdomadaire).</p>
        <div className="form-row">
          <label>Ouverture<input type="date" value={f.ouverture} onChange={(e) => set('ouverture', e.target.value)} /></label>
          <label>Valable jusqu’au<input type="date" value={f.fin} onChange={(e) => set('fin', e.target.value)} /></label>
        </div>
        {!config?.module && <p className="note small">Le module Cotisations n’est pas activé pour l’application : les adhérents ne voient pas encore leur situation. Un administrateur peut l’activer depuis les réglages de l’app.</p>}
      </div>
    </Panel>
  );
}
