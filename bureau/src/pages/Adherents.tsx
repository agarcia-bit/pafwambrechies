import { useMemo, useState } from 'react';

import { cotisStatus, formatDay, fullName, loadMembers, mailto, STATUS_LABEL, useAsync, type MemberRow } from '../lib';

type Filter = 'tous' | 'a_relancer' | 'non_inscrits';
type SortKey = 'nom' | 'cotisation';

export function Adherents() {
  const members = useAsync(loadMembers, []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'nom', dir: 1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());

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

  if (members.loading) return <p className="muted">Chargement…</p>;
  if (members.error) return <p className="error">{members.error}</p>;

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const chosen = rows.filter((m) => picked.has(m.key) && m.email);
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');
  const all = members.data!;

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Rechercher un nom ou un e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {([['tous', `Tous (${all.length})`], ['a_relancer', `À relancer (${all.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour').length})`], ['non_inscrits', `Pas inscrits (${all.filter((m) => !m.inscrit).length})`]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {chosen.length > 0 && (
        <div className="bar">
          {chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}
          <a className="button primary" href={mailto(chosen.map((m) => m.email!), 'Message du bureau', '')}>Écrire aux sélectionnés</a>
          <button className="link" onClick={() => setPicked(new Set())}>Tout désélectionner</button>
        </div>
      )}
      <div className="card flush">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Tout sélectionner" checked={rows.length > 0 && rows.every((m) => picked.has(m.key))} onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((m) => m.key)) : new Set())} /></th>
              <th className="sortable" onClick={() => sortBy('nom')}>Adhérent{arrow('nom')}</th>
              <th>E-mail</th>
              <th className="sortable" onClick={() => sortBy('cotisation')}>Cotisation{arrow('cotisation')}</th>
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => <Row key={m.key} m={m} on={picked.has(m.key)} toggle={() => toggle(m.key)} />)}
            {!rows.length && <tr><td colSpan={5} className="muted empty">Aucun adhérent ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ m, on, toggle }: { m: MemberRow; on: boolean; toggle: () => void }) {
  const status = cotisStatus(m.valide_jusqu);
  return (
    <tr>
      <td><input type="checkbox" aria-label={`Sélectionner ${fullName(m)}`} checked={on} onChange={toggle} /></td>
      <td>{fullName(m)}{m.role && m.role !== 'adherent' && <span className="tag">{m.role}</span>}</td>
      <td className="muted">{m.email}</td>
      <td><span className={'badge ' + status}>{STATUS_LABEL[status]}</span>{m.valide_jusqu && <span className="muted"> {formatDay(m.valide_jusqu)}</span>}</td>
      <td>{m.inscrit ? <span className="badge a_jour">Inscrit</span> : <span className="badge aucune">En attente</span>}</td>
    </tr>
  );
}
