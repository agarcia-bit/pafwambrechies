import { useMemo, useRef, useState } from 'react';

import { Icon } from '../Icon';
import { formatDay, supabase } from '../lib';
import { parseImport } from '../import-adherents';

type Result = { invites: number; deja_inscrits: number; cotisations: number; ignores: number };

export function Importer() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseImport(text), [text]);

  async function readFile(file: File) {
    setResult(null);
    setText(await file.text());
  }

  async function run() {
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('importer_adherents', { p_rows: parsed.rows });
    setBusy(false);
    if (error) return setError(error.message);
    setResult(data as Result);
    setText('');
  }

  return (
    <>
      <p className="muted">Déposez un fichier CSV exporté d’Excel, Numbers ou Google Sheets, ou collez les lignes directement. Colonnes reconnues : prénom, nom, e-mail, et la date de fin de cotisation (facultative).</p>
      <div className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}>
        <div className="row">
          <button className="primary" onClick={() => input.current?.click()}><Icon name="upload" size={15} /> Choisir un fichier CSV</button>
          <span className="muted">ou collez ci-dessous</span>
        </div>
        <input ref={input} type="file" accept=".csv,.txt,.tsv,text/csv" hidden onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        <textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder={'Prénom;Nom;E-mail;Cotisation jusqu’au\nMarie;Dupont;marie@exemple.fr;31/12/2026'} />
      </div>

      {result && (
        <div className="card ok">
          <strong>Import terminé.</strong> {result.invites} adhérent{result.invites > 1 ? 's' : ''} ajouté{result.invites > 1 ? 's' : ''} à inviter, {result.cotisations} cotisation{result.cotisations > 1 ? 's' : ''} enregistrée{result.cotisations > 1 ? 's' : ''}
          {result.deja_inscrits ? `, ${result.deja_inscrits} déjà inscrit${result.deja_inscrits > 1 ? 's' : ''}` : ''}{result.ignores ? `, ${result.ignores} ignoré${result.ignores > 1 ? 's' : ''}` : ''}. <a href="#adherents">Voir les adhérents</a>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {text.trim() && (
        <>
          <div className="bar">
            <span><strong>{parsed.rows.length}</strong> ligne{parsed.rows.length > 1 ? 's' : ''} valide{parsed.rows.length > 1 ? 's' : ''}{parsed.errors.length ? `, ${parsed.errors.length} à corriger` : ''}</span>
            <button className="primary" disabled={busy || !parsed.rows.length} onClick={run}>{busy ? 'Import…' : `Importer ${parsed.rows.length} adhérent${parsed.rows.length > 1 ? 's' : ''}`}</button>
          </div>
          {parsed.errors.length > 0 && (
            <div className="card">
              <h2>À corriger (ces lignes ne seront pas importées)</h2>
              <ul className="plain compact">{parsed.errors.map((e) => <li key={e.line}>Ligne {e.line} : <span className="error">{e.reason}</span> <span className="muted">{e.text}</span></li>)}</ul>
            </div>
          )}
          <div className="card flush">
            <table>
              <thead><tr><th>Prénom</th><th>Nom</th><th>E-mail</th><th>Cotisation jusqu’au</th></tr></thead>
              <tbody>
                {parsed.rows.slice(0, 200).map((r) => (
                  <tr key={r.email}><td>{r.prenom}</td><td>{r.nom}</td><td className="muted">{r.email}</td><td className="muted">{r.valide_jusqu ? formatDay(r.valide_jusqu) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
