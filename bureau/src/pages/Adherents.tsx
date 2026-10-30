import { useEffect, useMemo, useState } from 'react';

import {
  addOneYear, cotisStatus, formatDay, fullName, loadMembers, mailto, STATUS_LABEL, supabase, today, toast, useAsync, type MemberRow,
} from '../lib';

type Filter = 'tous' | 'a_relancer' | 'non_inscrits';
type SortKey = 'nom' | 'cotisation';
const PAGE = 50;

export function Adherents() {
  const members = useAsync(loadMembers, []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'nom', dir: 1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  // Un lien « À relancer » de la vue d'ensemble arrive avec ?filtre=a_relancer
  useEffect(() => {
    const f = new URLSearchParams(location.hash.split('?')[1] ?? '').get('filtre');
    if (f === 'a_relancer' || f === 'non_inscrits') setFilter(f);
  }, []);
  useEffect(() => setPage(0), [q, filter, sort]);

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

  if (members.loading && !members.data) return <p className="muted">Chargement…</p>;
  if (members.error) return <p className="error">{members.error}</p>;

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const chosen = rows.filter((m) => picked.has(m.key) && m.email);
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');
  const all = members.data!;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, (page + 1) * PAGE);
  const current = open ? all.find((m) => m.key === open) ?? null : null;

  // Un e-mail avec trop de destinataires est refusé par la messagerie : envoi par groupes de 50.
  const MAIL_GROUP = 50;
  const groups = Array.from({ length: Math.ceil(chosen.length / MAIL_GROUP) }, (_, k) => chosen.slice(k * MAIL_GROUP, (k + 1) * MAIL_GROUP));

  function exportCsv() {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Prénom', 'Nom', 'E-mail', 'Cotisation jusqu’au', 'Inscrit'].join(';'),
      ...rows.map((m) => [esc(m.prenom), esc(m.nom), esc(m.email), esc(m.valide_jusqu), esc(m.inscrit ? 'oui' : 'non')].join(';'))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `adherents-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Rechercher un nom ou un e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {([['tous', `Tous (${all.length})`], ['a_relancer', `À relancer (${all.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour').length})`], ['non_inscrits', `Pas inscrits (${all.filter((m) => !m.inscrit).length})`]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="push" onClick={exportCsv}>Exporter en CSV</button>
      </div>
      {chosen.length > 0 && (
        <div className="bar">
          <span>{chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}</span>
          <span className="row" style={{ margin: 0 }}>
            {groups.map((g, k) => (
              <a key={k} className="button primary" href={mailto(g.map((m) => m.email!), 'Message du bureau', '')}>
                {groups.length > 1 ? `Écrire au groupe ${k + 1} sur ${groups.length} (${g.length})` : 'Écrire aux sélectionnés'}
              </a>
            ))}
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
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const status = cotisStatus(m.valide_jusqu);
              return (
                <tr key={m.key} onClick={() => setOpen(m.key)} className={m.key === open ? 'sel' : ''}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${fullName(m)}`} checked={picked.has(m.key)} onChange={() => toggle(m.key)} /></td>
                  <td>{fullName(m)}{m.role && m.role !== 'adherent' && <span className="tag">{m.role}</span>}</td>
                  <td className="muted">{m.email}</td>
                  <td><span className={'badge ' + status}>{STATUS_LABEL[status]}</span>{m.valide_jusqu && <span className="muted"> {formatDay(m.valide_jusqu)}</span>}</td>
                  <td>{m.inscrit ? <span className="badge a_jour">Inscrit</span> : <span className="badge aucune">En attente</span>}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="muted empty">Aucun adhérent ne correspond.</td></tr>}
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
      {current && <Drawer m={current} onClose={() => setOpen(null)} onChanged={() => members.reload()} />}
    </>
  );
}

function Drawer({ m, onClose, onChanged }: { m: MemberRow; onClose: () => void; onChanged: () => void }) {
  const [date, setDate] = useState(m.valide_jusqu && cotisStatus(m.valide_jusqu) === 'a_jour' ? m.valide_jusqu : addOneYear(today()));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDate(m.valide_jusqu && cotisStatus(m.valide_jusqu) === 'a_jour' ? m.valide_jusqu : addOneYear(today()));
  }, [m.key, m.valide_jusqu]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [onClose]);
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
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-label={`Fiche de ${fullName(m)}`}>
        <div className="head">
          <div>
            <h2>{fullName(m)}</h2>
            <span className="muted">{m.email}</span>
          </div>
          <button className="link" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <p>
          {m.inscrit ? <span className="badge a_jour">Inscrit sur l’app</span> : <span className="badge aucune">Pas encore inscrit</span>}
          {m.role && m.role !== 'adherent' && <span className="tag">{m.role}</span>}
        </p>
        <h3>Cotisation</h3>
        <p><span className={'badge ' + status}>{STATUS_LABEL[status]}</span>{m.valide_jusqu && <span className="muted"> jusqu’au {formatDay(m.valide_jusqu)}</span>}</p>
        <label>Valable jusqu’au<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row">
          <button className="primary" disabled={busy || !date} onClick={save}>{status === 'a_jour' ? 'Mettre à jour' : 'Enregistrer le renouvellement'}</button>
          {m.id && m.valide_jusqu && <button className="link danger" disabled={busy} onClick={clear}>Effacer</button>}
        </div>
        <p className="muted small">La date proposée est à 12 mois. Le paiement lui-même se fait sur votre page de règlement, hors de l’app.</p>
        {m.email && <p><a className="button" href={mailto([m.email], 'Message du bureau', '')}>Écrire à cette personne</a></p>}
        {!m.inscrit && <p><button className="link danger" disabled={busy} onClick={removeInvite}>Retirer de la liste</button></p>}
      </aside>
    </>
  );
}
