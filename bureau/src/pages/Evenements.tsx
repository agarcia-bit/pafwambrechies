import { daysUntil, formatDay, fullName, mailto, supabase, useAsync } from '../lib';

type Ev = { id: number; titre: string; date: string; lieu: string | null; participation: boolean };
type Answer = { id: string; prenom: string | null; nom: string | null; reponse: 'present' | 'absent' | 'indecis' | null };

export function Evenements() {
  const events = useAsync(async () => {
    const { data, error } = await supabase
      .from('evenements').select('id, titre, date, lieu, participation').gte('date', new Date().toISOString().slice(0, 10)).order('date');
    if (error) throw error;
    return data as Ev[];
  }, []);
  if (events.loading) return <p className="muted">Chargement…</p>;
  if (events.error) return <p className="error">{events.error}</p>;
  if (!events.data?.length) return <p className="muted">Aucun événement à venir.</p>;
  return <>{events.data.map((e) => <EventCard key={e.id} e={e} />)}</>;
}

function EventCard({ e }: { e: Ev }) {
  const answers = useAsync(async () => {
    if (!e.participation) return [] as Answer[];
    const { data, error } = await supabase.rpc('evenement_participants', { p_evenement: e.id });
    if (error) throw error;
    return data as Answer[];
  }, [e.id]);
  // E-mails of the members who have not answered (the RPC does not return them).
  const mails = useAsync(async () => {
    const { data } = await supabase.rpc('list_cotisations');
    return Object.fromEntries(((data as { id: string; email: string | null }[]) ?? []).map((m) => [m.id, m.email]));
  }, []);

  const list = answers.data ?? [];
  const by = (r: Answer['reponse']) => list.filter((a) => a.reponse === r);
  const silent = list.filter((a) => !a.reponse || a.reponse === 'indecis');
  const silentMails = silent.map((a) => mails.data?.[a.id]).filter((m): m is string => !!m);

  return (
    <section className="card">
      <div className="head">
        <div>
          <h2>{e.titre}</h2>
          <span className="muted">{formatDay(e.date)} · dans {daysUntil(e.date)} j{e.lieu ? ` · ${e.lieu}` : ''}</span>
        </div>
        {e.participation && silentMails.length > 0 && (
          <a className="button" href={mailto(silentMails, `Seras-tu présent·e : ${e.titre} ?`, `Bonjour,\n\nPeux-tu répondre dans l’application pour « ${e.titre} » (${formatDay(e.date)}) ?\n\nMerci !`)}>
            Relancer les {silentMails.length} silencieux
          </a>
        )}
      </div>
      {!e.participation ? (
        <p className="muted">Les réponses ne sont pas demandées pour cet événement (à activer dans l’application).</p>
      ) : answers.loading ? <p className="muted">Chargement…</p> : answers.error ? <p className="error">{answers.error}</p> : (
        <div className="cols3">
          <Col title="Présents" tone="a_jour" people={by('present')} />
          <Col title="Absents" tone="expiree" people={by('absent')} />
          <Col title="Sans réponse / indécis" tone="aucune" people={silent} />
        </div>
      )}
    </section>
  );
}

function Col({ title, tone, people }: { title: string; tone: string; people: Answer[] }) {
  return (
    <div>
      <h3><span className={'badge ' + tone}>{people.length}</span> {title}</h3>
      <ul className="plain compact">{people.map((p) => <li key={p.id}>{fullName(p)}</li>)}</ul>
    </div>
  );
}
