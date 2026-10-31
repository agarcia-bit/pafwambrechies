import { useState } from 'react';

import { Avatar, Empty, Icon } from '../Icon';
import { ACTION_STATUTS, daysUntil, dueLabel, isOverdue, nameOf, today, type Action, type BureauMember, type Tache } from '../lib';

export type ViewProps = {
  actions: Action[]; taches: Tache[]; members: BureauMember[]; me: string;
  onOpen: (id: number) => void;
  onToggle: (t: Tache) => void;
  onAddTask: (a: Action, libelle: string) => void;
  onMove: (a: Action, statut: string) => void;
};

export const TONE: Record<string, string> = { 'À faire': 'neutral', 'En cours': 'info', Bloqué: 'bad', Terminé: 'ok' };
const byDue = (a: Tache, b: Tache) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const monthShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

// ── Briques partagées ────────────────────────────────────────────────────────

function Progress({ list }: { list: Tache[] }) {
  if (!list.length) return null;
  const done = list.filter((t) => t.statut === 'Terminé').length;
  return (
    <div className="progress" title={`${done} tâche(s) sur ${list.length}`}>
      <div className="bar"><span style={{ width: `${(done / list.length) * 100}%` }} className={done === list.length ? 'full' : ''} /></div>
      <small>{done}/{list.length}</small>
    </div>
  );
}

function TaskRow({ t, members, onToggle, who, actionOf }: { t: Tache; members: BureauMember[]; onToggle: (t: Tache) => void; who?: boolean; actionOf?: (id: number) => Action | undefined }) {
  const done = t.statut === 'Terminé';
  const late = isOverdue(t.echeance, t.statut);
  const a = actionOf?.(t.action_id);
  return (
    <li className={'task' + (done ? ' done' : '')}>
      <button className={'check' + (done ? ' on' : '')} aria-label={done ? 'Rouvrir' : 'Terminer'} onClick={() => onToggle(t)}>{done && <Icon name="check" size={12} />}</button>
      <div className="grow">
        <div className="task-title">{t.libelle}{t.priorite === 'Haute' && !done && <span className="pill bad">Haute</span>}</div>
        {(who || a) && <div className="task-meta muted">{a && <span>{a.emoji || '📌'} {a.titre}</span>}{who && a && ' · '}{who && nameOf(members, t.responsable)}</div>}
      </div>
      {t.echeance && <span className={'due' + (late ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
    </li>
  );
}

function QuickAdd({ onAdd, placeholder = 'Ajouter une tâche…' }: { onAdd: (text: string) => void; placeholder?: string }) {
  const [v, setV] = useState('');
  const go = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
  return (
    <div className="quick-add">
      <Icon name="plus" size={15} />
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder={placeholder} aria-label={placeholder} />
      {v.trim() && <button className="ghost small" onClick={go}>Ajouter</button>}
    </div>
  );
}

function ActionTitle({ a, onOpen }: { a: Action; onOpen: (id: number) => void }) {
  return <button className="action-title" onClick={() => onOpen(a.id)}><span className="emoji">{a.emoji || '📌'}</span>{a.titre}</button>;
}

function StatusSelect({ a, onMove }: { a: Action; onMove: (a: Action, s: string) => void }) {
  return (
    <select className={'status ' + TONE[a.statut]} value={a.statut} onChange={(e) => onMove(a, e.target.value)} aria-label="Statut" onClick={(e) => e.stopPropagation()}>
      {ACTION_STATUTS.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}

// ── Panneau latéral : mes tâches, puis les prochaines dates ─────────────────

export type CalEvent = { id: number; titre: string; date: string };

export function SidePanel({ taches, actions, members, me, onToggle, onOpen, events }: ViewProps & { events: CalEvent[] }) {
  const mine = taches.filter((t) => t.responsable === me && t.statut !== 'Terminé').sort(byDue);
  const late = mine.filter((t) => isOverdue(t.echeance, t.statut)).length;
  const actionOf = (id: number) => actions.find((a) => a.id === id);
  // Les 30 prochains jours : actions du bureau et événements de l'agenda, mêlés par date.
  const horizon = [
    ...actions.filter((a) => a.statut !== 'Terminé' && a.date_action >= today()).map((a) => ({ k: 'a' + a.id, date: a.date_action, text: `${a.emoji || '📌'} ${a.titre}`, open: () => onOpen(a.id) })),
    ...events.map((e) => ({ k: 'e' + e.id, date: e.date, text: e.titre, open: () => { location.hash = 'evenements'; } })),
  ].filter((i) => daysUntil(i.date) <= 30).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  return (
    <aside className="side-panel">
      <div className="side-head">
        <h3>Pour moi</h3>
        <span className={'pill ' + (late ? 'bad' : mine.length ? 'brand' : 'neutral')}>{late ? `${late} en retard` : `${mine.length} à faire`}</span>
      </div>
      {mine.length ? (
        <ul className="task-list">{mine.map((t) => <TaskRow key={t.id} t={t} members={members} onToggle={onToggle} actionOf={actionOf} />)}</ul>
      ) : <Empty icon="sparkle" title="Rien pour vous" hint="Vos tâches apparaîtront ici." />}
      <div className="side-head" style={{ marginTop: 18 }}>
        <h3>30 prochains jours</h3>
      </div>
      {horizon.length ? (
        <ul className="agenda-list">
          {horizon.map((i) => (
            <li key={i.k}>
              <span className={'tl-date mini' + (i.k[0] === 'e' ? ' event' : '')}><b>{dayNum(i.date)}</b><span>{monthShort(i.date)}</span></span>
              <button className="link" onClick={i.open}>{i.text}</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted small empty-line">Rien de prévu.</p>}
    </aside>
  );
}

// ── 1. Chronologie ───────────────────────────────────────────────────────────

export function Chronologie({ actions, taches, members, onOpen, onToggle, onAddTask, onMove }: ViewProps) {
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const flip = (id: number) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const monthLabel = (key: string) => { const s = new Date(key + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };

  const open = actions.filter((a) => a.statut !== 'Terminé').sort((a, b) => a.date_action.localeCompare(b.date_action));
  const groups: { title: string; tone?: string; items: Action[] }[] = [];
  const push = (title: string, items: Action[], tone?: string) => items.length && groups.push({ title, items, tone });
  push('En retard', open.filter((a) => a.date_action < today()), 'bad');
  const soon = open.filter((a) => a.date_action >= today() && daysUntil(a.date_action) <= 14);
  push('Dans les deux semaines', soon, 'brand');
  const rest = open.filter((a) => daysUntil(a.date_action) > 14);
  for (const key of [...new Set(rest.map((a) => a.date_action.slice(0, 7)))]) push(monthLabel(key), rest.filter((a) => a.date_action.startsWith(key)));
  const done = actions.filter((a) => a.statut === 'Terminé').sort((a, b) => b.date_action.localeCompare(a.date_action));

  const Item = ({ a }: { a: Action }) => {
    const list = taches.filter((t) => t.action_id === a.id).sort(byDue);
    const openT = list.filter((t) => t.statut !== 'Terminé');
    const late = openT.filter((t) => isOverdue(t.echeance, t.statut)).length;
    const isOpen = expanded.has(a.id) || (openT.length > 0 && openT.length <= 3);
    const d = daysUntil(a.date_action);
    return (
      <article className={'tl-item' + (a.statut === 'Terminé' ? ' is-done' : '')}>
        <div className={'tl-date' + (d < 0 && a.statut !== 'Terminé' ? ' late' : '')}><b>{dayNum(a.date_action)}</b><span>{monthShort(a.date_action)}</span></div>
        <div className="tl-card">
          <div className="tl-row">
            <ActionTitle a={a} onOpen={onOpen} />
            <StatusSelect a={a} onMove={onMove} />
            <span className="grow" />
            <span className="who muted"><Avatar name={nameOf(members, a.referent)} size={22} />{nameOf(members, a.referent)}</span>
          </div>
          <div className="tl-row sub muted">
            {d === 0 ? 'Aujourd’hui' : d === 1 ? 'Demain' : d > 0 ? `Dans ${d} jours` : `Il y a ${-d} jours`}
            {a.budget ? <> · {a.budget.toLocaleString('fr-FR')} €</> : null}
            {late > 0 && <span className="pill bad">{late} en retard</span>}
            <span className="grow" />
            {list.length > 0 && <button className="ghost small" onClick={() => flip(a.id)}>{isOpen ? 'Replier' : `${openT.length} tâche${openT.length > 1 ? 's' : ''} ouverte${openT.length > 1 ? 's' : ''}`}</button>}
          </div>
          <Progress list={list} />
          {isOpen && (
            <>
              {openT.length > 0 && <ul className="task-list">{openT.map((t) => <TaskRow key={t.id} t={t} members={members} onToggle={onToggle} who />)}</ul>}
              <QuickAdd onAdd={(text) => onAddTask(a, text)} />
            </>
          )}
        </div>
      </article>
    );
  };

  if (!actions.length) return <Empty icon="flag" title="Aucune action pour l’instant" hint="Créez la première avec « Nouvelle action »." />;
  return (
    <div className="timeline">
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className={'tl-group ' + (g.tone ?? '')}>{g.title}<span>{g.items.length}</span></h3>
          {g.items.map((a) => <Item key={a.id} a={a} />)}
        </section>
      ))}
      {!groups.length && <Empty icon="sparkle" title="Tout est terminé" hint="Aucune action en cours." />}
      {done.length > 0 && (
        <section>
          <button className="ghost" onClick={() => setShowDone(!showDone)}><Icon name={showDone ? 'x' : 'check'} size={14} /> {showDone ? 'Masquer' : 'Voir'} les {done.length} terminée{done.length > 1 ? 's' : ''}</button>
          {showDone && done.map((a) => <Item key={a.id} a={a} />)}
        </section>
      )}
    </div>
  );
}

// ── 2. Équipe ────────────────────────────────────────────────────────────────

export function Equipe({ actions, taches, members, me, onOpen, onToggle }: ViewProps) {
  const people = [
    ...members.filter((m) => m.is_bureau).map((m) => ({ id: m.id as string | null, name: nameOf(members, m.id) })),
    { id: null, name: 'Non assigné' },
  ].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0));
  const openT = taches.filter((t) => t.statut !== 'Terminé');
  const max = Math.max(1, ...people.map((p) => openT.filter((t) => t.responsable === p.id).length));
  const actionOf = (id: number) => actions.find((a) => a.id === id);

  return (
    <div className="team">
      {people.map((p) => {
        const mine = openT.filter((t) => t.responsable === p.id).sort(byDue);
        const late = mine.filter((t) => isOverdue(t.echeance, t.statut)).length;
        const led = actions.filter((a) => a.referent === p.id && a.statut !== 'Terminé');
        if (p.id === null && !mine.length) return null;
        return (
          <section key={p.id ?? 'none'} className={'card team-card' + (p.id === me ? ' is-me' : '')}>
            <div className="team-head">
              <Avatar name={p.name} size={40} />
              <div className="grow">
                <strong>{p.name}{p.id === me && <span className="pill brand">moi</span>}</strong>
                <div className="muted small">{led.length} action{led.length > 1 ? 's' : ''} · {mine.length} tâche{mine.length > 1 ? 's' : ''}{late ? <span className="late"> · {late} en retard</span> : null}</div>
              </div>
            </div>
            <div className="load" aria-hidden><span style={{ width: `${(mine.length / max) * 100}%` }} className={late ? 'bad' : ''} /></div>
            {led.length > 0 && <div className="chip-row">{led.map((a) => <button key={a.id} className="chip-mini" onClick={() => onOpen(a.id)}>{a.emoji || '📌'} {a.titre}</button>)}</div>}
            {mine.length ? <ul className="task-list">{mine.map((t) => <TaskRow key={t.id} t={t} members={members} onToggle={onToggle} actionOf={actionOf} />)}</ul> : <p className="muted small empty-line">Aucune tâche ouverte.</p>}
          </section>
        );
      })}
    </div>
  );
}
