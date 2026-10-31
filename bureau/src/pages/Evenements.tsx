import { useState } from 'react';

import type { PageProps } from '../App';
import { Compose } from '../Compose';
import { Drawer } from '../Drawer';
import { Empty, Icon, Skeleton } from '../Icon';
import { daysUntil, formatDay, fullName, loadMembers, supabase, today, toast, useAsync, type Recipient } from '../lib';

type Ev = { id: number; titre: string; date: string; heure: string | null; lieu: string | null; description: string | null; participation: boolean };
type Reponse = 'present' | 'absent' | 'indecis';
type Member = { id: string | null; prenom: string | null; nom: string | null; email: string | null };

export function Evenements({ profile }: PageProps) {
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState<number | 'new' | null>(null);
  // Tout est chargé en trois requêtes, quel que soit le nombre d'événements.
  const data = useAsync(async () => {
    const [ev, rep, members] = await Promise.all([
      supabase.from('evenements').select('id, titre, date, heure, lieu, description, participation').order('date').order('heure'),
      supabase.from('evenement_reponses').select('evenement_id, user_id, reponse'),
      loadMembers(),
    ]);
    if (ev.error) throw ev.error;
    if (rep.error) throw rep.error;
    const answers: Record<number, Record<string, Reponse>> = {};
    for (const r of rep.data as { evenement_id: number; user_id: string; reponse: Reponse }[]) (answers[r.evenement_id] ??= {})[r.user_id] = r.reponse;
    return { events: ev.data as Ev[], answers, members: members.filter((m) => m.inscrit) };
  }, []);

  if (data.loading && !data.data) return <div className="card"><Skeleton lines={5} /></div>;
  if (data.error) return <p className="error">{data.error}</p>;
  const { events, answers, members } = data.data!;
  const list = events.filter((e) => (past ? e.date < today() : e.date >= today()));
  if (past) list.reverse();
  const current = open === 'new' ? null : open === null ? undefined : events.find((e) => e.id === open) ?? undefined;

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={!past ? 'chip on' : 'chip'} onClick={() => setPast(false)}>À venir ({events.filter((e) => e.date >= today()).length})</button>
          <button className={past ? 'chip on' : 'chip'} onClick={() => setPast(true)}>Passés ({events.filter((e) => e.date < today()).length})</button>
        </div>
        <button className="push primary" onClick={() => setOpen('new')}><Icon name="plus" size={16} /> Nouvel événement</button>
      </div>
      {!list.length && (
        <Empty icon="calendar" title={past ? 'Aucun événement passé' : 'Aucun événement à venir'} hint="Les adhérents le verront dans l’agenda de l’application."
          action={!past ? <button className="primary" onClick={() => setOpen('new')}><Icon name="plus" size={15} /> Créer un événement</button> : undefined} />
      )}
      {list.map((e) => <EventCard key={e.id} e={e} answers={answers[e.id] ?? {}} members={members} onEdit={() => setOpen(e.id)} />)}
      {open !== null && current !== undefined && (
        <EventDrawer e={current} tenant={profile.tenant_id} onClose={() => setOpen(null)} onChanged={data.reload} />
      )}
    </>
  );
}

function EventCard({ e, answers, members, onEdit }: { e: Ev; answers: Record<string, Reponse>; members: Member[]; onEdit: () => void }) {
  const [openCol, setOpenCol] = useState<'present' | 'absent' | 'silence' | null>(null);
  const [compose, setCompose] = useState(false);
  const groups = {
    present: members.filter((m) => answers[m.id!] === 'present'),
    absent: members.filter((m) => answers[m.id!] === 'absent'),
    silence: members.filter((m) => !answers[m.id!] || answers[m.id!] === 'indecis'),
  };
  const total = members.length || 1;
  const silent: Recipient[] = groups.silence.filter((m) => m.email).map((m) => ({ email: m.email!, user_id: m.id }));
  const d = daysUntil(e.date);
  const when = d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : d > 0 ? `dans ${d} jours` : `il y a ${-d} jours`;

  const cols: { key: 'present' | 'absent' | 'silence'; label: string; tone: string }[] = [
    { key: 'present', label: 'Présents', tone: 'ok' },
    { key: 'absent', label: 'Absents', tone: 'bad' },
    { key: 'silence', label: 'Sans réponse', tone: 'neutral' },
  ];

  return (
    <section className="card">
      <div className="head">
        <div>
          <h2>{e.titre}</h2>
          <span className="muted">{formatDay(e.date)}{e.heure ? ` · ${e.heure}` : ''} · {when}{e.lieu ? ` · ${e.lieu}` : ''}</span>
        </div>
        <div className="btn-group">
          {e.participation && d >= 0 && silent.length > 0 && (
            <button onClick={() => setCompose(true)}><Icon name="mail" size={15} /> Relancer les {silent.length} silencieux</button>
          )}
          <button className="icon-btn" onClick={onEdit} aria-label="Modifier" title="Modifier"><Icon name="edit" /></button>
        </div>
      </div>
      {e.description && <p className="muted pre">{e.description}</p>}
      {!e.participation ? (
        <p className="muted small">Les réponses ne sont pas demandées pour cet événement.</p>
      ) : (
        <>
          <div className="meter" aria-hidden>
            <span className="ok" style={{ width: `${(groups.present.length / total) * 100}%` }} />
            <span className="bad" style={{ width: `${(groups.absent.length / total) * 100}%` }} />
          </div>
          <div className="summary">
            {cols.map((c) => (
              <button key={c.key} className={'sum' + (openCol === c.key ? ' on' : '')} onClick={() => setOpenCol(openCol === c.key ? null : c.key)}>
                <span className={'badge ' + c.tone}>{groups[c.key].length}</span> {c.label}
              </button>
            ))}
          </div>
          {openCol && (
            <ul className="plain compact names">
              {groups[openCol].map((m) => <li key={m.id}>{fullName(m)}</li>)}
              {!groups[openCol].length && <li className="muted">Personne.</li>}
            </ul>
          )}
        </>
      )}
      {compose && (
        <Compose
          to={silent}
          subject={`Seras-tu présent·e : ${e.titre} ?`}
          body={`Bonjour,\n\nPeux-tu répondre dans l’application pour « ${e.titre} » (${formatDay(e.date)}${e.lieu ? `, ${e.lieu}` : ''}) ?\n\nMerci !`}
          onClose={() => setCompose(false)}
        />
      )}
    </section>
  );
}

// ── Création / modification ──────────────────────────────────────────────────

// « heure » est un texte libre partagé avec l'application : "09:00 – 10:00".
const splitHeure = (h: string | null) => { const [debut = '', fin = ''] = (h ?? '').match(/\d{1,2}:\d{2}/g) ?? []; return { debut, fin }; };
const joinHeure = (debut: string, fin: string) => (debut && fin ? `${debut} – ${fin}` : debut || fin || null);

function EventDrawer({ e, tenant, onClose, onChanged }: { e: Ev | null; tenant: string; onClose: () => void; onChanged: () => void }) {
  const h = splitHeure(e?.heure ?? null);
  const [f, setF] = useState({
    titre: e?.titre ?? '', date: e?.date ?? today(), debut: e ? h.debut : '19:00', fin: e ? h.fin : '', lieu: e?.lieu ?? '',
    description: e?.description ?? '', participation: e?.participation ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.titre.trim() || !f.date) return toast('Le titre et la date sont obligatoires.', 'error');
    setBusy(true);
    const row = { titre: f.titre.trim(), date: f.date, heure: joinHeure(f.debut, f.fin), lieu: f.lieu.trim() || null, description: f.description.trim() || null, participation: f.participation };
    const { error } = e
      ? await supabase.from('evenements').update(row).eq('id', e.id)
      : await supabase.from('evenements').insert({ ...row, tenant_id: tenant });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(e ? 'Événement modifié' : 'Événement créé');
    onChanged();
    onClose();
  }
  async function remove() {
    if (!e || !confirm(`Supprimer « ${e.titre} » ? Les réponses des adhérents seront perdues.`)) return;
    setBusy(true);
    const { error } = await supabase.from('evenements').delete().eq('id', e.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Événement supprimé');
    onChanged();
    onClose();
  }

  return (
    <Drawer
      title={e ? 'Modifier l’événement' : 'Nouvel événement'}
      subtitle="Visible par tous les adhérents dans l’agenda de l’application."
      onClose={onClose}
      footer={
        <>
          {e && <button className="link danger" onClick={remove} disabled={busy}>Supprimer</button>}
          <span className="grow" />
          <button onClick={onClose} disabled={busy}>Annuler</button>
          <button className="primary" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : e ? 'Enregistrer' : 'Créer'}</button>
        </>
      }>
      <div className="form">
        <label>Titre<input type="text" value={f.titre} onChange={(ev) => set('titre', ev.target.value)} placeholder="Ex. : Assemblée générale" autoFocus /></label>
        <div className="form-row">
          <label>Date<input type="date" value={f.date} onChange={(ev) => set('date', ev.target.value)} /></label>
          <label>Début<input type="time" value={f.debut} onChange={(ev) => set('debut', ev.target.value)} /></label>
          <label>Fin<input type="time" value={f.fin} onChange={(ev) => set('fin', ev.target.value)} /></label>
        </div>
        <label>Lieu<input type="text" value={f.lieu} onChange={(ev) => set('lieu', ev.target.value)} placeholder="Ex. : Salle des fêtes" /></label>
        <label>Description<textarea className="plain-text" rows={5} value={f.description} onChange={(ev) => set('description', ev.target.value)} placeholder="Programme, consignes, ce qu’il faut apporter…" /></label>
        <label className="switch">
          <input type="checkbox" checked={f.participation} onChange={(ev) => set('participation', ev.target.checked)} />
          <span className="track" /><span>Demander aux adhérents s’ils viennent</span>
        </label>
        {f.participation && <p className="muted small">Un rappel est envoyé dans l’application 7 jours puis 2 jours avant à ceux qui n’ont pas répondu.</p>}
      </div>
    </Drawer>
  );
}
