import type { PageProps } from '../App';
import { Icon } from '../Icon';
import { cotisStatus, daysUntil, dueLabel, formatDay, fullName, isOverdue, loadBureau, loadMembers, supabase, today, useAsync } from '../lib';

export function Overview({ profile }: PageProps) {
  const members = useAsync(loadMembers, []);
  const bureau = useAsync(loadBureau, []);
  const events = useAsync(async () => {
    const { data, error } = await supabase.from('evenements').select('id, titre, date, participation').gte('date', today()).order('date').limit(4);
    if (error) throw error;
    return data as { id: number; titre: string; date: string; participation: boolean }[];
  }, []);

  if (members.loading) return <p className="muted">Chargement…</p>;
  if (members.error) return <p className="error">{members.error}</p>;
  const all = members.data!;
  const waiting = all.filter((m) => !m.inscrit);
  const upToDate = all.filter((m) => cotisStatus(m.valide_jusqu) === 'a_jour').length;
  const expired = all.filter((m) => cotisStatus(m.valide_jusqu) === 'expiree').length;
  const never = all.length - upToDate - expired;
  const toChase = all.length - upToDate;

  const b = bureau.data;
  const openTasks = b?.taches.filter((t) => t.statut !== 'Terminé') ?? [];
  const late = openTasks.filter((t) => isOverdue(t.echeance, t.statut));
  const mine = openTasks.filter((t) => t.responsable === profile.id).sort((x, y) => (x.echeance ?? '9999').localeCompare(y.echeance ?? '9999'));
  const hour = new Date().getHours();

  return (
    <>
      <p className="hello">{hour < 18 ? 'Bonjour' : 'Bonsoir'} {profile.prenom ?? ''} 👋</p>
      <div className="stats">
        <Stat icon="users" tone="brand" label="Adhérents" value={all.length} href="#adherents" />
        <Stat icon="check" tone="ok" label="Cotisations à jour" value={upToDate} href="#adherents" />
        <Stat icon="alert" tone={toChase ? 'warn' : 'ok'} label="À relancer" value={toChase} href="#adherents?filtre=a_relancer" />
        <Stat icon="mail" tone="info" label="Pas encore inscrits" value={waiting.length} href="#adherents?filtre=non_inscrits" />
      </div>

      <div className="grid2">
        <section className="card">
          <div className="head"><h2>Cotisations</h2><a href="#adherents?filtre=a_relancer">Voir les adhérents à relancer →</a></div>
          <div className="donut-wrap">
            <Donut parts={[{ v: upToDate, c: 'var(--ok)' }, { v: expired, c: 'var(--bad)' }, { v: never, c: 'var(--line-strong)' }]} label={all.length ? `${Math.round((upToDate / all.length) * 100)} %` : '—'} />
            <ul className="legend">
              <li><i style={{ background: 'var(--ok)' }} />À jour <strong>{upToDate}</strong></li>
              <li><i style={{ background: 'var(--bad)' }} />Expirées <strong>{expired}</strong></li>
              <li><i style={{ background: 'var(--line-strong)' }} />Jamais réglées <strong>{never}</strong></li>
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="head"><h2>Mes tâches</h2><a href="#pilotage">Ouvrir le pilotage →</a></div>
          {bureau.loading && !b ? <p className="muted">Chargement…</p> : mine.length ? (
            <ul className="todo compact">
              {mine.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <span className="check static" />
                  <div className="grow"><div className="t-title">{t.libelle}</div></div>
                  {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="empty-state">Rien à faire pour vous. 🎉</p>}
          {late.length > 0 && <p className="note-bad"><Icon name="alert" size={15} /> {late.length} tâche{late.length > 1 ? 's' : ''} en retard dans le bureau</p>}
        </section>

        <section className="card">
          <div className="head"><h2>Prochains événements</h2><a href="#evenements">Tout voir →</a></div>
          {events.data?.length ? (
            <ul className="plain">
              {events.data.map((e) => {
                const d = daysUntil(e.date);
                return (
                  <li key={e.id}>
                    <span className="date-chip"><b>{new Date(e.date + 'T00:00:00').getDate()}</b>{new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    <span className="grow">{e.titre}</span>
                    <span className="muted small">{d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} j`}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">Aucun événement à venir.</p>}
        </section>

        <section className="card">
          <div className="head"><h2>À relancer en priorité</h2></div>
          {toChase ? (
            <ul className="plain">
              {all.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour').slice(0, 5).map((m) => (
                <li key={m.key}><span className="grow">{fullName(m)}</span><span className="muted small">{m.valide_jusqu ? `expirée le ${formatDay(m.valide_jusqu)}` : 'jamais réglée'}</span></li>
              ))}
            </ul>
          ) : <p className="empty-state">Tout le monde est à jour. 🎉</p>}
        </section>
      </div>
    </>
  );
}

function Stat({ icon, tone, label, value, note, href }: { icon: string; tone: string; label: string; value: number; note?: string; href: string }) {
  return (
    <a href={href} className="card stat link-card">
      <span className={'tile ' + tone}><Icon name={icon} /></span>
      <div><strong>{value}</strong><span className="muted">{label}{note ? ` · ${note}` : ''}</span></div>
    </a>
  );
}

function Donut({ parts, label }: { parts: { v: number; c: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const r = 52, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`Cotisations à jour : ${label}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
      {parts.map((p, i) => {
        const len = (p.v / total) * C;
        const el = <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={p.c} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
        offset += len;
        return p.v ? el : null;
      })}
      <text x="70" y="76" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{label}</text>
    </svg>
  );
}
