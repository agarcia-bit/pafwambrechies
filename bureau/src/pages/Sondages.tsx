import { useState } from 'react';

import { Drawer } from '../Drawer';
import { Empty, Icon, Skeleton } from '../Icon';
import { formatDay, formatRelative, fullName, supabase, toast, useAsync } from '../lib';

type Option = { id: number; libelle: string; position: number };
type Reponse = { option_id: number; user_id: string; created_at: string };
type Sondage = { id: number; question: string; actif: boolean; obligatoire: boolean; date_limite: string | null; created_at: string; sondage_options: Option[]; sondage_reponses: Reponse[] };
type Member = { id: string; prenom: string | null; nom: string | null };
const MIN = 2, MAX = 6;

export function Sondages() {
  const data = useAsync(async () => {
    const [s, m] = await Promise.all([
      supabase.from('sondages').select('id, question, actif, obligatoire, date_limite, created_at, sondage_options(id, libelle, position), sondage_reponses(option_id, user_id, created_at)').order('created_at', { ascending: false }).order('position', { referencedTable: 'sondage_options' }),
      supabase.rpc('member_names'),
    ]);
    if (s.error) throw s.error;
    if (m.error) throw m.error;
    return { sondages: s.data as unknown as Sondage[], members: m.data as Member[] };
  }, []);
  const [create, setCreate] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [voters, setVoters] = useState<string | null>(null);

  if (data.loading && !data.data) return <div className="card"><Skeleton lines={5} /></div>;
  if (data.error) return <p className="error">{data.error}</p>;
  const { sondages, members } = data.data!;
  const nameOf = (id: string) => { const m = members.find((x) => x.id === id); return m ? fullName(m) : 'Ancien membre'; };
  const list = sondages.filter((s) => showClosed || s.actif);

  async function setActif(s: Sondage, actif: boolean) {
    const { error } = await supabase.from('sondages').update({ actif }).eq('id', s.id);
    if (error) return toast(error.message, 'error');
    toast(actif ? 'Sondage rouvert' : 'Sondage clos');
    data.reload();
  }
  async function remove(s: Sondage) {
    if (!confirm(`Supprimer le sondage « ${s.question} » et ses ${s.sondage_reponses.length} réponses ?`)) return;
    const { error } = await supabase.from('sondages').delete().eq('id', s.id);
    if (error) return toast(error.message, 'error');
    toast('Sondage supprimé');
    data.reload();
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={!showClosed ? 'chip on' : 'chip'} onClick={() => setShowClosed(false)}>En cours ({sondages.filter((s) => s.actif).length})</button>
          <button className={showClosed ? 'chip on' : 'chip'} onClick={() => setShowClosed(true)}>Tous ({sondages.length})</button>
        </div>
        <button className="push primary" onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Nouveau sondage</button>
      </div>
      {!list.length && <Empty icon="inbox" title="Aucun sondage en cours" hint="Un sondage reste en haut du fil des adhérents jusqu’à ce qu’ils répondent." action={<button className="primary" onClick={() => setCreate(true)}><Icon name="plus" size={15} /> Nouveau sondage</button>} />}
      {list.map((s) => {
        const total = s.sondage_reponses.length;
        return (
          <section key={s.id} className={'card' + (s.actif ? '' : ' is-done')}>
            <div className="head">
              <div>
                <h2>{s.question}</h2>
                <span className="muted small">
                  {formatRelative(s.created_at)} · {total} réponse{total > 1 ? 's' : ''} sur {members.length}
                  {s.date_limite ? ` · jusqu’au ${formatDay(s.date_limite)}` : ''}{s.obligatoire ? ' · obligatoire' : ''}{!s.actif ? ' · clos' : ''}
                </span>
              </div>
              <div className="btn-group">
                <button onClick={() => setActif(s, !s.actif)}>{s.actif ? 'Clore' : 'Rouvrir'}</button>
                <button className="icon-btn danger" onClick={() => remove(s)} aria-label="Supprimer" title="Supprimer"><Icon name="trash" /></button>
              </div>
            </div>
            <ul className="poll">
              {s.sondage_options.map((o) => {
                const votes = s.sondage_reponses.filter((r) => r.option_id === o.id);
                const key = `${s.id}:${o.id}`;
                return (
                  <li key={o.id}>
                    <button className="poll-row" onClick={() => setVoters(voters === key ? null : key)} disabled={!votes.length}>
                      <span className="poll-label">{o.libelle}</span>
                      <span className="poll-bar"><span style={{ width: `${total ? (votes.length / total) * 100 : 0}%` }} /></span>
                      <strong>{votes.length}</strong>
                    </button>
                    {voters === key && <p className="muted small voters">{votes.map((v) => nameOf(v.user_id)).sort((a, b) => a.localeCompare(b)).join(', ')}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {create && <CreateDrawer onClose={() => setCreate(false)} onChanged={data.reload} />}
    </>
  );
}

function CreateDrawer({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [obligatoire, setObligatoire] = useState(false);
  const [dateLimite, setDateLimite] = useState('');
  const [busy, setBusy] = useState(false);
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));

  async function save() {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3) return toast('Posez une question (3 caractères minimum).', 'error');
    if (opts.length < MIN) return toast(`Il faut au moins ${MIN} réponses possibles.`, 'error');
    setBusy(true);
    const { error } = await supabase.rpc('creer_sondage', { p_question: question.trim(), p_options: opts, p_obligatoire: obligatoire, p_date_limite: dateLimite || null });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Sondage publié');
    onChanged();
    onClose();
  }

  return (
    <Drawer title="Nouveau sondage" subtitle="Un seul choix par adhérent, sans retour en arrière. Les adhérents sont prévenus par notification." onClose={onClose}
      footer={<><button onClick={onClose} disabled={busy}>Annuler</button><span className="grow" /><button className="primary" onClick={save} disabled={busy}>{busy ? 'Publication…' : 'Publier'}</button></>}>
      <div className="form">
        <label>Question<input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Ex. : Quelle date pour l’assemblée générale ?" autoFocus /></label>
        <div>
          <span className="lbl">Réponses possibles</span>
          <div className="form" style={{ gap: 8, marginTop: 6 }}>
            {options.map((o, i) => (
              <div key={i} className="row" style={{ marginTop: 0, flexWrap: 'nowrap' }}>
                <input type="text" value={o} onChange={(e) => setOpt(i, e.target.value)} maxLength={120} placeholder={`Réponse ${i + 1}`} style={{ flex: 1 }} />
                {options.length > MIN && <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setOptions((x) => x.filter((_, k) => k !== i))}><Icon name="x" /></button>}
              </div>
            ))}
            {options.length < MAX && <button type="button" className="ghost small" style={{ justifySelf: 'start' }} onClick={() => setOptions((x) => [...x, ''])}><Icon name="plus" size={14} /> Ajouter une réponse</button>}
          </div>
        </div>
        <label>Date limite (facultatif)<input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} /></label>
        <label className="switch"><input type="checkbox" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} /><span className="track" /><span>Réponse obligatoire (l’app reste bloquée tant que l’adhérent n’a pas répondu)</span></label>
      </div>
    </Drawer>
  );
}
