import { useState } from 'react';

import { DUREES_DE_TRANCHE, libelleDeTranche, minutesDe, resumeDesTrous, tranchesDeLaJournee, trousDuPlanning, type Horaires, type Pole } from '../creneaux';
import { Icon } from '../Icon';
import { usePlanning, type PlanningEtat } from './usePlanning';
import './planning.css';

const HORAIRES_PROPOSES: Horaires = { debut: '10:00', fin: '18:00', dureeMinutes: 120 };

/** L'adresse de la page Planning d'une action. */
export const adresseDuPlanning = (actionId: number) => `#planning?action=${actionId}`;

/**
 * Dans la fiche d'une action, le planning tient en une carte : où il en est (« Il manque
 * 8 personnes ») et un lien vers sa page, où l'on a la place de le remplir.
 */
export function PlanningDeLAction({ actionId }: { actionId: number }) {
  const planning = usePlanning(actionId);
  if (!planning.estCharge) return null;
  const tranches = planning.horaires ? tranchesDeLaJournee(planning.horaires) : [];
  const estPret = tranches.length > 0 && planning.poles.length > 0;
  const { manque } = resumeDesTrous(trousDuPlanning(planning.poles, tranches, planning.inscrits));
  const etat = !planning.horaires ? 'Pas encore de planning' : !estPret ? 'Planning à terminer : ajoutez les pôles' : manque ? `Il manque ${manque} personne${manque > 1 ? 's' : ''}` : 'Tout est rempli';
  return (
    <section className="drawer-section">
      <div className="section-head"><h3>Planning des présences</h3>{planning.horaires && <StatutDuPlanning ouvert={planning.ouvert} />}</div>
      <a className={'carte-planning' + (estPret && manque ? ' manque' : '')} href={adresseDuPlanning(actionId)}>
        <span className="carte-planning-etat">{etat}</span>
        <span className="carte-planning-lien">{planning.horaires ? 'Ouvrir le planning' : 'Préparer un planning'} <Icon name="right" size={15} /></span>
      </a>
    </section>
  );
}

/** « Réservé au bureau » ou « Ouvert aux membres », avec une pastille de couleur. */
export function StatutDuPlanning({ ouvert }: { ouvert: boolean }) {
  return <span className={'statut-planning' + (ouvert ? ' ouvert' : '')}><i aria-hidden="true" />{ouvert ? 'Ouvert aux membres' : 'Réservé au bureau'}</span>;
}

/** « samedi 12 décembre » */
export const dateLongue = (jour: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${jour}T12:00:00Z`));

/** « de 10 h à 18 h · créneaux de 2 h » */
export function resumeDesHoraires(h: Horaires) {
  const heure = (hhmm: string) => libelleDeTranche(hhmm, 0).split(' – ')[0];
  const duree = h.dureeMinutes < 60 ? `${h.dureeMinutes} min` : `${Math.floor(h.dureeMinutes / 60)} h${h.dureeMinutes % 60 ? ' 30' : ''}`;
  return `de ${heure(h.debut)} à ${heure(h.fin)} · créneaux de ${duree}`;
}

/** Pas encore de planning : une phrase qui dit à quoi il sert, et des horaires proposés. */
export function DemarrerLePlanning({ onDemarrer }: { onDemarrer: (h: Horaires) => void }) {
  return (
    <div className="planning-vide">
      <p className="muted small">Besoin de bras le jour J ? Découpez la journée en créneaux, ajoutez les pôles (stand, buvette…), puis ouvrez le planning aux membres pour qu’ils s’inscrivent depuis l’app.</p>
      <button className="primary" onClick={() => onDemarrer(HORAIRES_PROPOSES)}><Icon name="plus" size={15} /> Préparer un planning</button>
    </div>
  );
}

export function ReglagesDuPlanning({ planning, horaires }: { planning: PlanningEtat; horaires: Horaires }) {
  const [brouillon, setBrouillon] = useState(horaires);
  const estModifie = brouillon.debut !== horaires.debut || brouillon.fin !== horaires.fin || brouillon.dureeMinutes !== horaires.dureeMinutes;
  const estValide = !!brouillon.debut && !!brouillon.fin && minutesDe(brouillon.fin) - minutesDe(brouillon.debut) >= brouillon.dureeMinutes;
  return (
    <div className="form">
      <div className="form-row planning-horaires">
        <label>De<input type="time" value={brouillon.debut} onChange={(e) => setBrouillon({ ...brouillon, debut: e.target.value })} /></label>
        <label>À<input type="time" value={brouillon.fin} onChange={(e) => setBrouillon({ ...brouillon, fin: e.target.value })} /></label>
        <label>Créneaux de
          <select value={brouillon.dureeMinutes} onChange={(e) => setBrouillon({ ...brouillon, dureeMinutes: Number(e.target.value) })}>
            {DUREES_DE_TRANCHE.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`.replace('.5 h', ' h 30')}</option>)}
          </select>
        </label>
        {estModifie && <button className="primary" disabled={!estValide} onClick={() => planning.enregistrerHoraires(brouillon)}>Enregistrer les horaires</button>}
      </div>
      {estModifie && !estValide && <p className="small error">L’heure de fin doit laisser la place à au moins un créneau.</p>}
    </div>
  );
}

export function ListeDesPoles({ planning }: { planning: PlanningEtat }) {
  const [nom, setNom] = useState('');
  const [personnes, setPersonnes] = useState(1);
  function ajouter() {
    if (!nom.trim()) return;
    planning.ajouterPole(nom, personnes);
    setNom('');
    setPersonnes(1);
  }
  return (
    <div className="planning-poles">
      <h4 className="small muted">Pôles</h4>
      <ul className="task-list editable">
        {planning.poles.map((p) => <LigneDePole key={p.id} pole={p} planning={planning} />)}
        {!planning.poles.length && <li className="muted small empty-line">Aucun pôle : ajoutez-en un (stand, gaufres, café…).</li>}
      </ul>
      <div className="quick-add">
        <Icon name="plus" size={15} />
        <input className="grow" value={nom} onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} placeholder="Ajouter un pôle… (Entrée)" aria-label="Nom du nouveau pôle" />
        <label className="small muted planning-nombre"><input type="number" min="0" max="50" value={personnes} onChange={(e) => setPersonnes(Number(e.target.value))} aria-label="Personnes en même temps" /> pers. en même temps</label>
        {nom.trim() && <button className="ghost small" onClick={ajouter}>Ajouter</button>}
      </div>
    </div>
  );
}

function LigneDePole({ pole, planning }: { pole: Pole; planning: PlanningEtat }) {
  const [nom, setNom] = useState(pole.nom);
  const inscrits = planning.inscrits.filter((i) => i.pole_id === pole.id).length;
  function supprimer() {
    const question = inscrits ? `Supprimer « ${pole.nom} » et ses ${inscrits} inscription${inscrits > 1 ? 's' : ''} ?` : `Supprimer « ${pole.nom} » ?`;
    if (confirm(question)) planning.supprimerPole(pole);
  }
  return (
    <li className="task">
      <input className="grow" type="text" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={() => nom.trim() && nom !== pole.nom && planning.modifierPole(pole, { nom: nom.trim() })} aria-label="Nom du pôle" />
      <label className="small muted planning-nombre">
        <input type="number" min="0" max="50" defaultValue={pole.personnes} onBlur={(e) => Number(e.target.value) !== pole.personnes && planning.modifierPole(pole, { personnes: Number(e.target.value) })} aria-label={`Personnes en même temps pour ${pole.nom}`} />
        pers. en même temps
      </label>
      <button className="icon-btn" aria-label={`Supprimer le pôle ${pole.nom}`} onClick={supprimer}><Icon name="trash" size={15} /></button>
    </li>
  );
}
