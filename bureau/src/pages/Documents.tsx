import { useRef, useState } from 'react';

import type { PageProps } from '../App';
import { formatDay, supabase, useAsync } from '../lib';

type Doc = { id: number; titre: string; categorie: string | null; path: string; nom_fichier: string; taille: number | null; created_at: string };

const MAX = 20 * 1024 * 1024;
const safeName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
const size = (b: number | null) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

export function Documents({ profile }: PageProps) {
  const docs = useAsync(async () => {
    const { data, error } = await supabase.from('documents').select('id, titre, categorie, path, nom_fichier, taille, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return data as Doc[];
  }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [over, setOver] = useState(false);
  const [categorie, setCategorie] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    setBusy(true);
    setMessage('');
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX) { problems.push(`${file.name} : plus de 20 Mo`); continue; }
      const path = `${profile.tenant_id}/${Date.now()}-${safeName(file.name)}`;
      const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
      if (up.error) { problems.push(`${file.name} : ${up.error.message}`); continue; }
      const ins = await supabase.from('documents').insert({
        titre: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) || file.name,
        categorie: categorie.trim() || null, path, nom_fichier: file.name, mime: file.type || null, taille: file.size,
      });
      if (ins.error) { await supabase.storage.from('documents').remove([path]); problems.push(`${file.name} : ${ins.error.message}`); }
    }
    setBusy(false);
    setMessage(problems.join(' — '));
    docs.reload();
  }

  async function open(d: Doc) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.path, 3600);
    if (error) return setMessage(error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function remove(d: Doc) {
    if (!confirm(`Supprimer « ${d.titre} » ? Les adhérents ne pourront plus l’ouvrir.`)) return;
    const { error } = await supabase.from('documents').delete().eq('id', d.id);
    if (error) return setMessage(error.message);
    await supabase.storage.from('documents').remove([d.path]);
    docs.reload();
  }

  return (
    <>
      <div
        className={'drop' + (over ? ' over' : '')}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
        <p><strong>{busy ? 'Envoi en cours…' : 'Déposez vos fichiers ici'}</strong></p>
        <p className="muted">PDF, images, Word, Excel, PowerPoint, texte — 20 Mo maximum. Visibles par tous les adhérents.</p>
        <div className="row">
          <input type="text" placeholder="Catégorie (facultatif) : Statuts, Comptes rendus…" value={categorie} onChange={(e) => setCategorie(e.target.value)} />
          <button className="primary" disabled={busy} onClick={() => input.current?.click()}>Choisir des fichiers</button>
        </div>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
      {message && <p className="error">{message}</p>}
      {docs.loading ? <p className="muted">Chargement…</p> : docs.error ? <p className="error">{docs.error}</p> : (
        <div className="card flush">
          <table>
            <thead><tr><th>Document</th><th>Catégorie</th><th>Ajouté le</th><th>Taille</th><th /></tr></thead>
            <tbody>
              {docs.data!.map((d) => (
                <tr key={d.id}>
                  <td><button className="link" onClick={() => open(d)}>{d.titre}</button><div className="muted small">{d.nom_fichier}</div></td>
                  <td className="muted">{d.categorie ?? '—'}</td>
                  <td className="muted">{formatDay(d.created_at.slice(0, 10))}</td>
                  <td className="muted">{size(d.taille)}</td>
                  <td className="right"><button className="link danger" onClick={() => remove(d)}>Supprimer</button></td>
                </tr>
              ))}
              {!docs.data!.length && <tr><td colSpan={5} className="muted empty">Aucun document pour l’instant.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
