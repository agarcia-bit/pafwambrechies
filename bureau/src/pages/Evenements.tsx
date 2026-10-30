import { useState } from 'react';

import { Empty, Skeleton } from '../Icon';
import { daysUntil, formatDay, fullName, loadMembers, mailto, supabase, today, useAsync } from '../lib';

type Ev = { id: number; titre: string; date: string; lieu: string | null; participation: boolean };
type Reponse = 'present' | 'absent' | 'indecis';

export function Evenements() {
  const [past, setPast] = useState(false);
  // Tout est chargé en trois requêtes, quel que soit le nombre d'événements.
  const data = useAsync(async () => {
    const [ev, rep, members] = await Promise.all([
      supabase.from('evenements').select('id, titre, date, lieu, participation').order('date'),
      supabase.from('evenement_reponses').select('evenement_id, user_id, reponse'),
      loadMembers(),
    ]);
    if (ev.error) throw ev.error;
    if (rep.error) throw rep.error;
    const answers: Record<number, Record<string, Reponse>> = {};
    for (const r of rep.data as { evenement_id: number; user_id: string; reponse: Reponse }[]) (answers[r.evenement_id] ??= {})[r.user_id] = r.reponse;
    return { events: ev.data as Ev[], answers, members: members.filter((m) => m.inscrit) };
  }, []);

  if (data.loading) return <div className="card"><Skeleton lines={5} /></div>;
  if (data.error) return <p className="error">{data.error}</p>;
  const { events, answers, members } = data.data!;
  const list = events.filter((e) => (past ? e.date < today() : e.date >= today()));
  if (past) list.reverse();

  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={!past ? 'chip on' : 'chip'} onClick={() => setPast(false)}>À venir</button>
        <button className={past ? 'chip on' : 'chip'} onClick={() => setPast(true)}>Passés</button>
      </div>
      {!list.length && <Empty icon="calendar" title={past ? 'Aucun événement passé' : 'Aucun événement à venir'} hint="Les événements se créent depuis l’application." />}
      {list.map((e) => <EventCard key={e.id} e={e} answers={answers[e.id] ?? {}} members={members} />)}
    </>
  );
}

function EventCard({ e, answers, members }: { e: Ev; answers: Record<string, Reponse>; members: { id: string | null; prenom: string | null; nom: string | null; email: string | null }[] }) {
  const [openCol, setOpenCol] = useState<'present' | 'absent' | 'silence' | null>(null);
  const groups = {
    present: members.filter((m) => answers[m.id!] === 'present'),
    absent: members.filter((m) => answers[m.id!] === 'absent'),
    silence: members.filter((m) => !answers[m.id!] || answers[m.id!] === 'indecis'),
  };
  const total = members.length || 1;
  const silentMails = groups.silence.map((m) => m.email).filter((m): m is string => !!m);
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
          <span className="muted">{formatDay(e.date)} · {when}{e.lieu ? ` · ${e.lieu}` : ''}</span>
        </div>
        {e.participation && d >= 0 && silentMails.length > 0 && (
          <a className="button" href={mailto(silentMails.slice(0, 50), `Seras-tu présent·e : ${e.titre} ?`, `Bonjour,\n\nPeux-tu répondre dans l’application pour « ${e.titre} » (${formatDay(e.date)}) ?\n\nMerci !`)}>
            Relancer les {Math.min(silentMails.length, 50)} silencieux
          </a>
        )}
      </div>
      {!e.participation ? (
        <p className="muted">Les réponses ne sont pas demandées pour cet événement (à activer depuis l’application).</p>
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
    </section>
  );
}
