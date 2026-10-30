import { useMemo, useState } from 'react';

import type { PageProps } from '../App';
import { Drawer } from '../Drawer';
import { Icon, Skeleton } from '../Icon';
import {
  ACTION_STATUTS, dueLabel, isOverdue, loadBureau, nameOf, PRIORITES, supabase, today, toast, useAsync,
  type Action, type BureauMember, type Tache,
} from '../lib';
import { Calendrier, Chronologie, Equipe, Kanban, MyTasks, TONE, type CalEvent } from './PilotageViews';

const VIEWS = [
  { key: 'chrono', label: 'Chronologie', icon: 'list', hint: 'Ce qui arrive, dans l’ordre' },
  { key: 'equipe', label: 'Équipe', icon: 'users', hint: 'Qui fait quoi' },
  { key: 'cal', label: 'Calendrier', icon: 'calendar', hint: 'Le mois en un coup d’œil' },
  { key: 'kanban', label: 'Kanban', icon: 'columns', hint: 'Par statut, à glisser' },
] as const;

export function Pilotage({ profile }: PageProps) {
  const data = useAsync(loadBureau, []);
  const agenda = useAsync(async () => {
    const { data } = await supabase.from('evenements').select('id, titre, date').gte('date', today());
    return (data ?? []) as CalEvent[];
  }, []);
  const [onlyMe, setOnlyMe] = useState(false);
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const [view, setViewState] = useState<string>(() => { try { return localStorage.getItem('pilotage-vue') || 'chrono'; } catch { return 'chrono'; } });
  const setView = (v: string) => { setViewState(v); try { localStorage.setItem('pilotage-vue', v); } catch { /* sans stockage */ } };

  const kpi = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const openTasks = d.taches.filter((t) => t.statut !== 'Terminé');
    return {
      aVenir: d.actions.filter((a) => a.statut !== 'Terminé' && a.date_action >= today()).length,
      enCours: d.actions.filter((a) => a.statut === 'En cours').length,
      bloque: d.actions.filter((a) => a.statut === 'Bloqué').length,
      retard: openTasks.filter((t) => isOverdue(t.echeance, t.statut)).length,
      mine: openTasks.filter((t) => t.responsable === profile.id).length,
      budget: d.actions.filter((a) => a.statut !== 'Terminé').reduce((s, a) => s + (a.budget ?? 0), 0),
    };
  }, [data.data, profile.id]);

  if (data.loading && !data.data) return <div className="card"><Skeleton lines={6} /></div>;
  if (data.error) return <p className="error">{data.error}</p>;
  const all = data.data!;
  const actionOf = (id: number) => all.actions.find((a) => a.id === id);

  // « Moi uniquement » : mes tâches, et les actions dont je suis référent ou où j'ai une tâche.
  const taches = onlyMe ? all.taches.filter((t) => t.responsable === profile.id) : all.taches;
  const actions = onlyMe ? all.actions.filter((a) => a.referent === profile.id || taches.some((t) => t.action_id === a.id)) : all.actions;

  async function toggle(t: Tache) {
    const { error } = await supabase.from('taches').update({ statut: t.statut === 'Terminé' ? 'À faire' : 'Terminé' }).eq('id', t.id);
    if (error) return toast(error.message, 'error');
    if (t.statut !== 'Terminé') toast('Tâche terminée ✓');
    data.reload();
  }
  async function addTask(a: Action, libelle: string) {
    const { error } = await supabase.from('taches').insert({ action_id: a.id, tenant_id: profile.tenant_id, libelle, responsable: a.referent });
    if (error) return toast(error.message, 'error');
    toast('Tâche ajoutée');
    data.reload();
  }
  async function moveAction(a: Action, statut: string) {
    if (a.statut === statut) return;
    const { error } = await supabase.from('actions').update({ statut }).eq('id', a.id);
    if (error) return toast(error.message, 'error');
    toast(`« ${a.titre} » → ${statut}`);
    data.reload();
  }

  const props = { actions, taches, members: all.members, me: profile.id, onOpen: setOpen, onToggle: toggle, onAddTask: addTask, onMove: moveAction };
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

  return (
    <>
      <div className="kpis">
        <Kpi value={kpi!.aVenir} label="actions à venir" />
        <Kpi value={kpi!.enCours} label="en cours" tone="info" />
        {kpi!.bloque > 0 && <Kpi value={kpi!.bloque} label={kpi!.bloque > 1 ? 'bloquées' : 'bloquée'} tone="bad" />}
        <Kpi value={kpi!.retard} label={kpi!.retard > 1 ? 'tâches en retard' : 'tâche en retard'} tone={kpi!.retard ? 'bad' : 'ok'} />
        <Kpi value={kpi!.mine} label={kpi!.mine > 1 ? 'tâches pour moi' : 'tâche pour moi'} tone="brand" />
        {kpi!.budget > 0 && <Kpi value={`${kpi!.budget.toLocaleString('fr-FR')} €`} label="budget engagé" />}
      </div>

      <div className="view-bar">
        <div className="seg" role="tablist" aria-label="Vue">
          {VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)} title={v.hint}>
              <Icon name={v.icon} size={15} /><span>{v.label}</span>
            </button>
          ))}
        </div>
        <span className="muted small view-hint">{current.hint}</span>
        <span className="grow" />
        <label className="switch">
          <input type="checkbox" checked={onlyMe} onChange={(e) => setOnlyMe(e.target.checked)} />
          <span className="track" /><span>Moi uniquement</span>
        </label>
        <button className="primary" onClick={() => setOpen('new')}><Icon name="plus" size={16} /> Nouvelle action</button>
      </div>

      {view === 'chrono' && (
        <div className="with-side">
          <Chronologie {...props} />
          <MyTasks {...props} actions={all.actions} taches={all.taches} />
        </div>
      )}
      {view === 'equipe' && <Equipe {...props} />}
      {view === 'cal' && <Calendrier {...props} events={agenda.data ?? []} />}
      {view === 'kanban' && <Kanban {...props} />}

      {open !== null && (
        <ActionDrawer
          action={open === 'new' ? null : actionOf(open) ?? null}
          taches={open === 'new' ? [] : all.taches.filter((t) => t.action_id === open)}
          members={all.members}
          me={profile.id}
          tenant={profile.tenant_id}
          onClose={() => setOpen(null)}
          onChanged={data.reload}
        />
      )}
    </>
  );
}

function Kpi({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return <div className={'kpi ' + (tone ?? '')}><strong>{value}</strong><span>{label}</span></div>;
}

// ── Fiche d'une action ───────────────────────────────────────────────────────

function ActionDrawer({ action, taches, members, me, tenant, onClose, onChanged }: {
  action: Action | null; taches: Tache[]; members: BureauMember[]; me: string; tenant: string; onClose: () => void; onChanged: () => void;
}) {
  const [id, setId] = useState<number | null>(action?.id ?? null);
  const [f, setF] = useState({
    emoji: action?.emoji ?? '', titre: action?.titre ?? '', date_action: action?.date_action ?? today(),
    referent: action?.referent ?? me, statut: action?.statut ?? 'À faire', budget: action?.budget?.toString() ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [nt, setNt] = useState({ libelle: '', responsable: action?.referent ?? me, echeance: '', priorite: 'Moyenne' });
  const people = members.filter((m) => m.is_bureau || m.id === f.referent);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };

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
    setDirty(false);
    onChanged();
  }
  async function remove() {
    if (!id || !confirm(`Supprimer « ${f.titre} » et toutes ses tâches ?`)) return;
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
  async function patchTask(t: Tache, patch: Partial<Tache>) {
    const { error } = await supabase.from('taches').update(patch).eq('id', t.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  }
  async function removeTask(t: Tache) {
    const { error } = await supabase.from('taches').delete().eq('id', t.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  }

  const list = [...taches].sort((a, b) => (a.statut === 'Terminé') === (b.statut === 'Terminé') ? (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') : a.statut === 'Terminé' ? 1 : -1);
  const done = list.filter((t) => t.statut === 'Terminé').length;

  return (
    <Drawer
      wide
      onClose={onClose}
      title={<span className="drawer-title"><span className="emoji-box">{f.emoji || '📌'}</span>{id ? f.titre || 'Action' : 'Nouvelle action'}</span>}
      subtitle={id ? <span className={'pill ' + TONE[f.statut]}>{f.statut}</span> : 'Un projet ou un événement que le bureau pilote.'}
      footer={
        <>
          {id && <button className="ghost danger" onClick={remove}><Icon name="trash" size={15} /> Supprimer</button>}
          <span className="grow" />
          <button className="ghost" onClick={onClose}>Fermer</button>
          <button className="primary" disabled={busy || !f.titre.trim() || (!!id && !dirty)} onClick={save}>{id ? 'Enregistrer' : 'Créer l’action'}</button>
        </>
      }>
      <div className="form">
        <div className="form-row">
          <label className="w-emoji">Icône<input type="text" maxLength={4} value={f.emoji} onChange={set('emoji')} placeholder="📌" /></label>
          <label className="grow">Titre<input type="text" value={f.titre} onChange={set('titre')} placeholder="Ex. Organiser le Beaujolais nouveau" autoFocus={!id} /></label>
        </div>
        <div className="form-row">
          <label>Date<input type="date" value={f.date_action} onChange={set('date_action')} /></label>
          <label>Statut<select value={f.statut} onChange={set('statut')}>{ACTION_STATUTS.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Référent<select value={f.referent} onChange={set('referent')}><option value="">Non assigné</option>{people.map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select></label>
          <label>Budget (€)<input type="number" min="0" value={f.budget} onChange={set('budget')} placeholder="—" /></label>
        </div>
      </div>

      {id ? (
        <section className="drawer-section">
          <div className="section-head">
            <h3>Tâches</h3>
            <span className="muted small">{done}/{list.length} terminée{done > 1 ? 's' : ''}</span>
          </div>
          <ul className="task-list editable">
            {list.map((t) => {
              const isDone = t.statut === 'Terminé';
              return (
                <li key={t.id} className={'task' + (isDone ? ' done' : '')}>
                  <button className={'check' + (isDone ? ' on' : '')} aria-label={isDone ? 'Rouvrir' : 'Terminer'} onClick={() => patchTask(t, { statut: isDone ? 'À faire' : 'Terminé' })}>{isDone && <Icon name="check" size={12} />}</button>
                  <div className="grow">
                    <div className="task-title">{t.libelle}</div>
                    <div className="task-meta">
                      <select className="inline" value={t.responsable ?? ''} onChange={(e) => patchTask(t, { responsable: e.target.value || null })} aria-label="Responsable">
                        <option value="">Non assigné</option>{members.filter((m) => m.is_bureau || m.id === t.responsable).map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}
                      </select>
                      <input className="inline" type="date" value={t.echeance ?? ''} onChange={(e) => patchTask(t, { echeance: e.target.value || null })} aria-label="Échéance" />
                      <select className="inline" value={t.priorite} onChange={(e) => patchTask(t, { priorite: e.target.value as Tache['priorite'] })} aria-label="Priorité">
                        {PRIORITES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
                  <button className="icon-btn" aria-label="Supprimer la tâche" onClick={() => removeTask(t)}><Icon name="trash" size={15} /></button>
                </li>
              );
            })}
            {!list.length && <li className="muted small empty-line">Aucune tâche pour l’instant.</li>}
          </ul>
          <div className="add-task">
            <input type="text" placeholder="Nouvelle tâche… (Entrée pour ajouter)" value={nt.libelle} onChange={(e) => setNt({ ...nt, libelle: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
            <div className="form-row">
              <select value={nt.responsable} onChange={(e) => setNt({ ...nt, responsable: e.target.value })} aria-label="Responsable"><option value="">Non assigné</option>{members.filter((m) => m.is_bureau).map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select>
              <input type="date" value={nt.echeance} onChange={(e) => setNt({ ...nt, echeance: e.target.value })} aria-label="Échéance" />
              <select value={nt.priorite} onChange={(e) => setNt({ ...nt, priorite: e.target.value })} aria-label="Priorité">{PRIORITES.map((p) => <option key={p}>{p}</option>)}</select>
              <button className="primary" disabled={!nt.libelle.trim()} onClick={addTask}><Icon name="plus" size={15} /> Ajouter</button>
            </div>
          </div>
        </section>
      ) : <p className="muted small">Créez l’action pour pouvoir lui ajouter des tâches.</p>}
    </Drawer>
  );
}
