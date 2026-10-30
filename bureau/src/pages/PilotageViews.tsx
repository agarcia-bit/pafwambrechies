import { useState } from 'react';

import { Avatar, Icon } from '../Icon';
import { dueLabel, formatDay, isOverdue, nameOf, today, daysUntil, type Action, type BureauMember, type Tache } from '../lib';

export type ViewProps = {
  actions: Action[]; taches: Tache[]; members: BureauMember[];
  onOpen: (id: number) => void; onToggle: (t: Tache) => void;
};

const TONE: Record<string, string> = { 'À faire': 'neutral', 'En cours': 'info', Bloqué: 'bad', Terminé: 'ok' };
const byDue = (a: Tache, b: Tache) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999');

function Progress({ list }: { list: Tache[] }) {
  if (!list.length) return null;
  const done = list.filter((t) => t.statut === 'Terminé').length;
  return <div className="progress"><span style={{ width: `${(done / list.length) * 100}%` }} /><small>{done}/{list.length}</small></div>;
}

function TaskLine({ t, members, onToggle, showWho }: { t: Tache; members: BureauMember[]; onToggle: (t: Tache) => void; showWho?: boolean }) {
  const done = t.statut === 'Terminé';
  return (
    <li>
      <button className={'check' + (done ? ' done' : '')} aria-label={done ? 'Rouvrir la tâche' : 'Terminer la tâche'} onClick={() => onToggle(t)}>{done && <Icon name="check" size={13} />}</button>
      <div className="grow"><div className={'t-title' + (done ? ' struck' : '')}>{t.libelle}</div>{showWho && <div className="muted small">{nameOf(members, t.responsable)}</div>}</div>
      {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
    </li>
  );
}

// ── 1. Chronologie : ce qui arrive, dans l'ordre ─────────────────────────────
export function Chronologie({ actions, taches, members, onOpen, onToggle }: ViewProps) {
  const [showDone, setShowDone] = useState(false);
  const now = new Date();
  const monthKey = (d: string) => d.slice(0, 7);
  const label = (key: string) => { const s = new Date(key + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };

  const open = actions.filter((a) => a.statut !== 'Terminé').sort((a, b) => a.date_action.localeCompare(b.date_action));
  const groups: { title: string; tone?: string; items: Action[] }[] = [];
  const push = (title: string, items: Action[], tone?: string) => items.length && groups.push({ title, items, tone });
  push('En retard', open.filter((a) => a.date_action < today()), 'bad');
  const upcoming = open.filter((a) => a.date_action >= today());
  push('Cette semaine', upcoming.filter((a) => daysUntil(a.date_action) <= 7), 'brand');
  const rest = upcoming.filter((a) => daysUntil(a.date_action) > 7);
  for (const key of [...new Set(rest.map((a) => monthKey(a.date_action)))]) push(label(key), rest.filter((a) => monthKey(a.date_action) === key));
  const done = actions.filter((a) => a.statut === 'Terminé').sort((a, b) => b.date_action.localeCompare(a.date_action));

  const Row = ({ a }: { a: Action }) => {
    const list = taches.filter((t) => t.action_id === a.id).sort(byDue);
    const openTasks = list.filter((t) => t.statut !== 'Terminé');
    return (
      <article className="tl-item">
        <div className="tl-date"><b>{new Date(a.date_action + 'T00:00:00').getDate()}</b>{new Date(a.date_action + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}</div>
        <div className="tl-body">
          <div className="tl-head">
            <button className="link tl-title" onClick={() => onOpen(a.id)}>{a.emoji || '📌'} {a.titre}</button>
            <span className={'badge ' + TONE[a.statut]}>{a.statut}</span>
            <span className="grow" />
            {a.budget ? <span className="muted small">{a.budget.toLocaleString('fr-FR')} €</span> : null}
            <span className="who"><Avatar name={nameOf(members, a.referent)} size={24} /><span className="muted small">{nameOf(members, a.referent)}</span></span>
          </div>
          <Progress list={list} />
          {openTasks.length > 0 && <ul className="todo compact">{openTasks.map((t) => <TaskLine key={t.id} t={t} members={members} onToggle={onToggle} showWho />)}</ul>}
        </div>
      </article>
    );
  };

  return (
    <div className="timeline">
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className={'tl-group ' + (g.tone ?? '')}>{g.title} <span className="muted">{g.items.length}</span></h3>
          {g.items.map((a) => <Row key={a.id} a={a} />)}
        </section>
      ))}
      {!groups.length && <p className="empty-state">Aucune action à venir. Créez-en une avec « Nouvelle action ».</p>}
      {done.length > 0 && (
        <section>
          <button className="link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Masquer' : 'Afficher'} les {done.length} action{done.length > 1 ? 's' : ''} terminée{done.length > 1 ? 's' : ''}</button>
          {showDone && done.map((a) => <Row key={a.id} a={a} />)}
        </section>
      )}
      <span hidden>{now.getTime()}</span>
    </div>
  );
}

// ── 2. Équipe : qui fait quoi ────────────────────────────────────────────────
export function Equipe({ actions, taches, members, onOpen, onToggle }: ViewProps) {
  const people: { id: string | null; name: string }[] = [
    ...members.filter((m) => m.is_bureau).map((m) => ({ id: m.id, name: nameOf(members, m.id) })),
    { id: null, name: 'Non assigné' },
  ];
  const max = Math.max(1, ...people.map((p) => taches.filter((t) => t.responsable === p.id && t.statut !== 'Terminé').length));
  return (
    <div className="team">
      {people.map((p) => {
        const mine = taches.filter((t) => t.responsable === p.id && t.statut !== 'Terminé').sort(byDue);
        const late = mine.filter((t) => isOverdue(t.echeance, t.statut)).length;
        const led = actions.filter((a) => a.referent === p.id && a.statut !== 'Terminé');
        if (p.id === null && !mine.length && !led.length) return null;
        return (
          <section key={p.id ?? 'none'} className="card team-card">
            <div className="team-head">
              <Avatar name={p.name} size={40} />
              <div className="grow"><strong>{p.name}</strong>
                <div className="muted small">{led.length} action{led.length > 1 ? 's' : ''} · {mine.length} tâche{mine.length > 1 ? 's' : ''} ouverte{mine.length > 1 ? 's' : ''}{late ? <span className="late"> · {late} en retard</span> : null}</div>
              </div>
            </div>
            <div className="load" title="Charge de travail"><span style={{ width: `${(mine.length / max) * 100}%` }} className={late ? 'bad' : ''} /></div>
            {led.length > 0 && <div className="chips-row">{led.map((a) => <button key={a.id} className="mini" onClick={() => onOpen(a.id)}>{a.emoji || '📌'} {a.titre}</button>)}</div>}
            {mine.length ? (
              <ul className="todo compact">
                {mine.map((t) => { const a = actions.find((x) => x.id === t.action_id); return (
                  <li key={t.id}>
                    <button className="check" aria-label="Terminer la tâche" onClick={() => onToggle(t)} />
                    <div className="grow"><div className="t-title">{t.libelle}</div>{a && <button className="link small" onClick={() => onOpen(a.id)}>{a.emoji} {a.titre}</button>}</div>
                    {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
                  </li>); })}
              </ul>
            ) : <p className="muted small">Aucune tâche ouverte.</p>}
          </section>
        );
      })}
    </div>
  );
}

// ── 3. Calendrier : un mois d'un coup d'œil ──────────────────────────────────
export function Calendrier({ actions, taches, onOpen }: ViewProps) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // lundi en premier
  const days = Array.from({ length: Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7) * 7 }, (_, i) => new Date(y, m, i - offset + 1));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const title = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="card cal">
      <div className="head">
        <h2 style={{ textTransform: 'capitalize' }}>{title}</h2>
        <div className="row" style={{ margin: 0 }}>
          <button onClick={() => setCursor(new Date(y, m - 1, 1))} aria-label="Mois précédent">←</button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Aujourd’hui</button>
          <button onClick={() => setCursor(new Date(y, m + 1, 1))} aria-label="Mois suivant">→</button>
        </div>
      </div>
      <div className="cal-grid">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const key = iso(d);
          const items = [
            ...actions.filter((a) => a.date_action === key).map((a) => ({ k: 'a' + a.id, id: a.id, text: `${a.emoji || '📌'} ${a.titre}`, kind: 'action', late: false, done: a.statut === 'Terminé' })),
            ...taches.filter((t) => t.echeance === key).map((t) => ({ k: 't' + t.id, id: t.action_id, text: t.libelle, kind: 'task', late: isOverdue(t.echeance, t.statut), done: t.statut === 'Terminé' })),
          ];
          const shown = expanded === key ? items : items.slice(0, 3);
          return (
            <div key={key} className={'cal-day' + (d.getMonth() !== m ? ' off' : '') + (key === today() ? ' today' : '')}>
              <span className="cal-num">{d.getDate()}</span>
              {shown.map((i) => (
                <button key={i.k} className={'cal-chip ' + i.kind + (i.late ? ' late' : '') + (i.done ? ' done' : '')} onClick={() => onOpen(i.id)} title={i.text}>{i.text}</button>
              ))}
              {items.length > 3 && expanded !== key && <button className="link small" onClick={() => setExpanded(key)}>+{items.length - 3} de plus</button>}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: '12px 0 0' }}><span className="legend-chip action" /> Action <span className="legend-chip task" /> Tâche à rendre <span className="legend-chip late" /> En retard · {formatDay(today())}</p>
    </div>
  );
}
