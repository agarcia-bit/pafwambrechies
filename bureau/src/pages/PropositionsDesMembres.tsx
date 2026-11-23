import { useState } from 'react';

import { Drawer } from '../Drawer';
import { resumeDesSeances, seancesDeLaSerie, type Proposition } from '../evenements-proposes-regles';
import { Icon } from '../Icon';
import { dateLongue } from './PlanningDeLAction';
import type { Devenir, PropositionAvecSoutiens, PropositionsEtat } from './usePropositionsDesMembres';
import './propositions.css';

const TYPE: Record<Proposition['type'], string> = { a_organiser: 'À organiser avec le bureau', personnel: 'Son événement, à faire connaître' };

/** Quand : « 3 séances : 14 janv., 14 févr., 14 mars · 20 h · Bar du Centre » ou la période souhaitée. */
function quandEtOu(p: Proposition): string {
  if (p.type === 'a_organiser') return p.periode ? `Souhaité : ${p.periode}` : 'Date à choisir par le bureau';
  const seances = p.date ? seancesDeLaSerie(p.date, p.repetition, p.nb_mois ?? 3) : [];
  const quand = seances.length > 1 ? resumeDesSeances(seances) : p.date ? dateLongue(p.date) : '';
  return [quand, p.heure, p.lieu].filter(Boolean).join(' · ');
}

/** En haut du Pilotage : les propositions qui attendent une réponse. Rien quand il n'y en a pas. */
export function EncadreDesPropositions({ etat, onRepondre }: { etat: PropositionsEtat; onRepondre: (p: PropositionAvecSoutiens) => void }) {
  const { propositions } = etat;
  if (!propositions.length) return null;
  return (
    <section className="card propositions" aria-label="Propositions des membres">
      <h2><Icon name="sparkle" size={17} /> {propositions.length} proposition{propositions.length > 1 ? 's' : ''} des membres</h2>
      <ul>
        {propositions.map((p) => (
          <li key={p.id}>
            <div className="grow">
              <strong>{p.titre}</strong> <span className="muted">· {p.auteur_nom ?? 'Un membre'}</span>
              <p className="small muted">
                {TYPE[p.type]}{p.repetition !== 'aucune' ? ` · ${p.repetition === 'mois' ? 'chaque mois' : 'chaque semaine'}` : ''}
                {p.type === 'a_organiser' ? ` · ${p.soutiens} soutien${p.soutiens > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <button onClick={() => onRepondre(p)}>Répondre</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Props = { proposition: PropositionAvecSoutiens; etat: PropositionsEtat; onFermer: () => void };

/**
 * Répondre à une proposition. Accepter : son événement est publié dans l'Agenda (toutes ses
 * séances) ; une proposition à organiser devient, au choix, un événement de l'Agenda ou une action
 * du Pilotage, à la date choisie. Ne pas retenir : un mot facultatif part au membre.
 */
export function FenetreDeProposition({ proposition: p, etat, onFermer }: Props) {
  const [devenir, setDevenir] = useState<Devenir>('evenement');
  const [date, setDate] = useState('');
  const [mot, setMot] = useState('');
  const aOrganiser = p.type === 'a_organiser';
  async function accepter() {
    if (await etat.accepter(p, devenir, aOrganiser ? date : null)) onFermer();
  }
  async function refuser() {
    if (await etat.refuser(p, mot)) onFermer();
  }
  return (
    <Drawer title={p.titre} subtitle={`${TYPE[p.type]} · proposé par ${p.auteur_nom ?? 'un membre'}`} onClose={onFermer}
      footer={<>
        <button className="ghost" disabled={etat.enCours} onClick={refuser}>Ne pas retenir</button>
        <span className="grow" />
        <button className="primary" disabled={etat.enCours || (aOrganiser && !date)} onClick={accepter}>
          <Icon name="check" size={15} /> {aOrganiser ? 'Accepter' : 'Publier dans l’Agenda'}
        </button>
      </>}>
      <div className="proposition">
        <p className="proposition-quand"><Icon name="calendar" size={15} /> {quandEtOu(p)}</p>
        <p className="proposition-texte">{p.description}</p>
        {aOrganiser && <ChoixDuDevenir devenir={devenir} date={date} onDevenir={setDevenir} onDate={setDate} soutiens={p.soutiens} />}
        <label className="proposition-mot">Si vous ne retenez pas : un mot pour {p.auteur_nom?.split(' ')[0] ?? 'le membre'} (facultatif)
          <textarea className="plain-text" rows={3} maxLength={500} value={mot} placeholder="Ex : merci, mais la salle n’est pas libre ce mois-ci."
            onChange={(e) => setMot(e.target.value)} />
        </label>
      </div>
    </Drawer>
  );
}

type PropsDuChoix = { devenir: Devenir; date: string; soutiens: number; onDevenir: (d: Devenir) => void; onDate: (d: string) => void };

/** Une proposition à organiser : en faire un événement de l'Agenda ou une action du Pilotage, et quand. */
function ChoixDuDevenir({ devenir, date, soutiens, onDevenir, onDate }: PropsDuChoix) {
  return (
    <div className="proposition-choix">
      <p className="small muted">{soutiens ? `${soutiens} membre${soutiens > 1 ? 's soutiennent' : ' soutient'} cette idée dans la boîte à idées.` : 'Personne ne soutient encore cette idée dans la boîte à idées.'}</p>
      <div className="seg" role="group" aria-label="En faire">
        <button className={devenir === 'evenement' ? 'on' : ''} aria-pressed={devenir === 'evenement'} onClick={() => onDevenir('evenement')}>Un événement de l’Agenda</button>
        <button className={devenir === 'action' ? 'on' : ''} aria-pressed={devenir === 'action'} onClick={() => onDevenir('action')}>Une action du Pilotage</button>
      </div>
      <p className="small muted">{devenir === 'evenement' ? 'Les membres le verront dans l’Agenda et pourront dire s’ils viennent.' : 'Le bureau l’organise : tâches, référent, planning des bénévoles.'}</p>
      <label className="proposition-date">Date
        <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => onDate(e.target.value)} />
      </label>
    </div>
  );
}
