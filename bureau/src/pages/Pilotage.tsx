import { useMemo, useState } from 'react';

import type { PageProps } from '../App';
import { Drawer } from '../Drawer';
import { Avatar, Icon } from '../Icon';
import {
  ACTION_STATUTS, dueLabel, formatDay, isOverdue, loadBureau, nameOf, PRIORITES, supabase, today, toast, useAsync,
  type Action, type BureauMember, type Tache,
} from '../lib';

const STATUT_TONE: Record<string, string> = { 'À faire': 'neutral', 'En cours': 'info', Bloqué: 'bad', Terminé: 'ok' };

export function Pilotage({ profile }: PageProps) {
  const data = useAsync(loadBureau, []);
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState<number | 'new' | null>(null);

  const stats = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const openTasks = d.taches.filter((t) => t.statut !== 'Terminé');
    return {
      enCours: d.actions.filter((a) => a.statut === 'En cours').length,
      retard: openTasks.filter((t) => isOverdue(t.echeance, t.statut)).length,
      mine: openTasks.filter((t) => t.responsable === profile.id).length,
      budget: d.actions.filter((a) => a.statut !== 'Terminé').reduce((s, a) => s + (a.budget ?? 0), 0),
    };
  }, [data.data, profile.id]);

  if (data.loading && !data.data) return <p className="muted">Chargement…</p>;
  if (data.error) return <p className="error">{data.error}</p>;
  const { actions, taches, members } = data.data!;
  const actionOf = (id: number) => actions.find((a) => a.id === id);

  const todo = taches
    .filter((t) => t.statut !== 'Terminé' && (!mine || t.responsable === profile.id))
    .sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'));

  async function toggle(t: Tache) {
    const { error } = await supabase.from('taches').update({ statut: t.statut === 'Terminé' ? 'À faire' : 'Terminé' }).eq('id', t.id);
    if (error) return toast(error.message, 'error');
    if (t.statut !== 'Terminé') toast('Tâche terminée');
    data.reload();
  }

  return (
    <>
      <div className="stats">
        <Stat icon="target" label="Actions en cours" value={stats!.enCours} tone="info" />
        <Stat icon="alert" label="Tâches en retard" value={stats!.retard} tone={stats!.retard ? 'bad' : 'ok'} />
        <Stat icon="tasks" label="Mes tâches ouvertes" value={stats!.mine} tone="brand" />
        <Stat icon="euro" label="Budget des actions en cours" value={`${stats!.budget.toLocaleString('fr-FR')} €`} tone="neutral" />
      </div>

      <section className="card">
        <div className="head">
          <h2>À faire</h2>
          <div className="seg">
            <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Mes tâches</button>
            <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Tout le bureau</button>
          </div>
        </div>
        {todo.length ? (
          <ul className="todo">
            {todo.map((t) => {
              const late = isOverdue(t.echeance, t.statut);
              const a = actionOf(t.action_id);
              return (
                <li key={t.id}>
                  <button className="check" aria-label="Terminer la tâche" onClick={() => toggle(t)} />
                  <div className="grow">
                    <div className="t-title">{t.libelle}{t.priorite === 'Haute' && <span className="badge bad">Haute</span>}</div>
                    <div className="muted small">
                      {a && <button className="link" onClick={() => setOpen(a.id)}>{a.emoji} {a.titre}</button>}
                      {!mine && <> · {nameOf(members, t.responsable)}</>}
                    </div>
                  </div>
                  {t.echeance && <span className={'due' + (late ? ' late' : '')}><Icon name="clock" size={14} /> {dueLabel(t.echeance)}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">{mine ? 'Vous n’avez aucune tâche en cours. 🎉' : 'Aucune tâche ouverte.'}</p>
        )}
      </section>

      <div className="head" style={{ margin: '24px 0 12px' }}>
        <h2 style={{ margin: 0 }}>Actions du bureau</h2>
        <button className="primary" onClick={() => setOpen('new')}><Icon name="plus" size={16} /> Nouvelle action</button>
      </div>
      <div className="board">
        {ACTION_STATUTS.map((s) => {
          const col = actions.filter((a) => a.statut === s);
          return (
            <div key={s} className="col">
              <h3><span className={'dot ' + STATUT_TONE[s]} /> {s} <span className="muted">{col.length}</span></h3>
              {col.map((a) => {
                const list = taches.filter((t) => t.action_id === a.id);
                const done = list.filter((t) => t.statut === 'Terminé').length;
                return (
                  <button key={a.id} className="action-card" onClick={() => setOpen(a.id)}>
                    <div className="ac-title"><span className="emoji">{a.emoji || '📌'}</span> {a.titre}</div>
                    <div className="muted small"><Icon name="calendar" size={13} /> {formatDay(a.date_action)}{a.budget ? ` · ${a.budget.toLocaleString('fr-FR')} €` : ''}</div>
                    {list.length > 0 && (
                      <div className="progress"><span style={{ width: `${(done / list.length) * 100}%` }} /><small>{done}/{list.length}</small></div>
                    )}
                    <div className="ac-foot"><Avatar name={nameOf(members, a.referent)} size={22} /><span className="muted small">{nameOf(members, a.referent)}</span></div>
                  </button>
                );
              })}
              {!col.length && <p className="muted small col-empty">Aucune action</p>}
            </div>
          );
        })}
      </div>

      {open !== null && (
        <ActionDrawer
          action={open === 'new' ? null : actionOf(open) ?? null}
          taches={open === 'new' ? [] : taches.filter((t) => t.action_id === open)}
          members={members}
          me={profile.id}
          tenant={profile.tenant_id}
          onClose={() => setOpen(null)}
          onChanged={data.reload}
        />
      )}
    </>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number | string; tone: string }) {
  return (
    <div className="card stat">
      <span className={'tile ' + tone}><Icon name={icon === 'target' ? 'tasks' : icon} /></span>
      <div><strong>{value}</strong><span className="muted">{label}</span></div>
    </div>
  );
}

function ActionDrawer({ action, taches, members, me, tenant, onClose, onChanged }: {
  action: Action | null; taches: Tache[]; members: BureauMember[]; me: string; tenant: string; onClose: () => void; onChanged: () => void;
}) {
  const [id, setId] = useState<number | null>(action?.id ?? null);
  const [f, setF] = useState({
    emoji: action?.emoji ?? '', titre: action?.titre ?? '', date_action: action?.date_action ?? today(),
    referent: action?.referent ?? me, statut: action?.statut ?? 'À faire', budget: action?.budget?.toString() ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [nt, setNt] = useState({ libelle: '', responsable: action?.referent ?? me, echeance: '', priorite: 'Moyenne' });
  const people = members.filter((m) => m.is_bureau || m.id === f.referent);

  async function save() {
    setBusy(true);
    const values = { emoji: f.emoji.trim() || null, titre: f.titre.trim(), date_action: f.date_action, referent: f.referent || null, statut: f.statut, budget: f.budget ? Number(f.budget) : null };
    const res = id
      ? await supabase.from('actions').update(values).eq('id', id).select('id')
      : await supabase.from('actions').insert({ ...values, tenant_id: tenant }).select('id').single();
    setBusy(false);
    if (res.error) return toast(res.error.message, 'error');
    toast(id ? 'Action enregistrée' : 'Action créée');
    if (!id) setId((res.data as { id: number }).id);
    onChanged();
  }
  async function remove() {
    if (!id || !confirm('Supprimer cette action et toutes ses tâches ?')) return;
    const { error } = await supabase.from('actions').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Action supprimée');
    onChanged();
    onClose();
  }
  async function addTask() {
    if (!id || !nt.libelle.trim()) return;
    const { error } = await supabase.from('taches').insert({ action_id: id, tenant_id: tenant, libelle: nt.libelle.trim(), responsable: nt.responsable || null, echeance: nt.echeance || null, priorite: nt.priorite });
    if (error) return toast(error.message, 'error');
    setNt({ ...nt, libelle: '', echeance: '' });
    onChanged();
  }
  async function toggle(t: Tache) {
    const { error } = await supabase.from('taches').update({ statut: t.statut === 'Terminé' ? 'À faire' : 'Terminé' }).eq('id', t.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  }
  async function removeTask(t: Tache) {
    const { error } = await supabase.from('taches').delete().eq('id', t.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const mine = taches.filter((t) => t.action_id === id).sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'));

  return (
    <Drawer title={id ? 'Action' : 'Nouvelle action'} subtitle={id ? undefined : 'Un projet ou un événement que le bureau pilote'} onClose={onClose} wide>
      <div className="form">
        <div className="form-row">
          <label style={{ width: 80 }}>Icône<input type="text" maxLength={4} value={f.emoji} onChange={set('emoji')} placeholder="📌" /></label>
          <label className="grow">Titre<input type="text" value={f.titre} onChange={set('titre')} placeholder="Ex. Organiser le Beaujolais nouveau" /></label>
        </div>
        <div className="form-row">
          <label className="grow">Date<input type="date" value={f.date_action} onChange={set('date_action')} /></label>
          <label className="grow">Statut<select value={f.statut} onChange={set('statut')}>{ACTION_STATUTS.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label className="grow">Référent<select value={f.referent} onChange={set('referent')}><option value="">Non assigné</option>{people.map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select></label>
          <label className="grow">Budget (€)<input type="number" min="0" value={f.budget} onChange={set('budget')} placeholder="—" /></label>
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="primary" disabled={busy || !f.titre.trim()} onClick={save}>{id ? 'Enregistrer' : 'Créer l’action'}</button>
          {id && <button className="link danger" onClick={remove}><Icon name="trash" size={15} /> Supprimer</button>}
        </div>
      </div>

      {id ? (
        <>
          <h3 className="sect">Tâches ({mine.filter((t) => t.statut === 'Terminé').length}/{mine.length})</h3>
          <ul className="todo compact">
            {mine.map((t) => (
              <li key={t.id}>
                <button className={'check' + (t.statut === 'Terminé' ? ' done' : '')} aria-label="Cocher" onClick={() => toggle(t)}>{t.statut === 'Terminé' && <Icon name="check" size={13} />}</button>
                <div className="grow">
                  <div className={'t-title' + (t.statut === 'Terminé' ? ' struck' : '')}>{t.libelle}</div>
                  <div className="muted small">{nameOf(members, t.responsable)}{t.priorite === 'Haute' ? ' · Priorité haute' : ''}</div>
                </div>
                {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
                <button className="icon-btn" aria-label="Supprimer la tâche" onClick={() => removeTask(t)}><Icon name="trash" size={15} /></button>
              </li>
            ))}
            {!mine.length && <li className="muted">Aucune tâche pour l’instant.</li>}
          </ul>
          <div className="add-task">
            <input type="text" placeholder="Nouvelle tâche…" value={nt.libelle} onChange={(e) => setNt({ ...nt, libelle: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
            <div className="form-row">
              <select value={nt.responsable} onChange={(e) => setNt({ ...nt, responsable: e.target.value })}><option value="">Non assigné</option>{members.filter((m) => m.is_bureau).map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select>
              <input type="date" value={nt.echeance} onChange={(e) => setNt({ ...nt, echeance: e.target.value })} />
              <select value={nt.priorite} onChange={(e) => setNt({ ...nt, priorite: e.target.value })}>{PRIORITES.map((p) => <option key={p}>{p}</option>)}</select>
              <button className="primary" disabled={!nt.libelle.trim()} onClick={addTask}><Icon name="plus" size={16} /> Ajouter</button>
            </div>
          </div>
        </>
      ) : <p className="muted small">Créez l’action pour pouvoir lui ajouter des tâches.</p>}
    </Drawer>
  );
}
