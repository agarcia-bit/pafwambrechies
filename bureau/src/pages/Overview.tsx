import { cotisStatus, daysUntil, formatDay, fullName, loadMembers, supabase, useAsync } from '../lib';

export function Overview() {
  const members = useAsync(loadMembers, []);
  const events = useAsync(async () => {
    const { data, error } = await supabase
      .from('evenements').select('id, titre, date, participation').gte('date', new Date().toISOString().slice(0, 10)).order('date').limit(5);
    if (error) throw error;
    return data as { id: number; titre: string; date: string; participation: boolean }[];
  }, []);

  if (members.loading) return <p className="muted">Chargement…</p>;
  if (members.error) return <p className="error">{members.error}</p>;
  const all = members.data!;
  const inscrits = all.filter((m) => m.inscrit);
  const upToDate = all.filter((m) => cotisStatus(m.valide_jusqu) === 'a_jour').length;
  const toChase = all.filter((m) => cotisStatus(m.valide_jusqu) !== 'a_jour');
  const waiting = all.filter((m) => !m.inscrit);

  return (
    <>
      <div className="stats">
        <Stat label="Adhérents" value={all.length} href="#adherents" />
        <Stat label="Inscrits sur l’app" value={inscrits.length} note={waiting.length ? `${waiting.length} pas encore inscrits` : undefined} href={waiting.length ? '#adherents?filtre=non_inscrits' : '#adherents'} />
        <Stat label="Cotisations à jour" value={upToDate} note={all.length ? `${Math.round((upToDate / all.length) * 100)} %` : undefined} />
        <Stat label="À relancer" value={toChase.length} warn={toChase.length > 0} href="#adherents?filtre=a_relancer" />
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Prochains événements</h2>
          {events.data?.length ? (
            <ul className="plain">
              {events.data.map((e) => (
                <li key={e.id}><a href="#evenements">{e.titre}</a><span className="muted">{formatDay(e.date)} · {daysUntil(e.date) === 0 ? 'aujourd’hui' : daysUntil(e.date) === 1 ? 'demain' : `dans ${daysUntil(e.date)} j`}</span></li>
              ))}
            </ul>
          ) : <p className="muted">Aucun événement à venir.</p>}
        </section>
        <section className="card">
          <h2>Cotisations à relancer</h2>
          {toChase.length ? (
            <ul className="plain">
              {toChase.slice(0, 8).map((m) => (
                <li key={m.key}>{fullName(m)}<span className="muted">{m.valide_jusqu ? `expirée le ${formatDay(m.valide_jusqu)}` : 'jamais réglée'}</span></li>
              ))}
            </ul>
          ) : <p className="muted">Tout le monde est à jour.</p>}
          {toChase.length > 8 && <p><a href="#adherents?filtre=a_relancer">Voir les {toChase.length} adhérents</a></p>}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, note, warn, href }: { label: string; value: number; note?: string; warn?: boolean; href?: string }) {
  const Tag = href ? 'a' : 'div';
  return (
    <Tag href={href} className={'card stat' + (warn ? ' warn' : '') + (href ? ' link-card' : '')}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {note && <small className="muted">{note}</small>}
    </Tag>
  );
}
