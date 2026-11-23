import { useState } from 'react';

import { bilanDesPlaces, DUREES_DE_TRANCHE, minutesDe, tranchesDeLaJournee, type Horaires, type Pole } from '../creneaux';
import { Icon } from '../Icon';
import { GrilleDuPlanning } from './GrilleDuPlanning';
import { usePlanning, type PlanningEtat } from './usePlanning';
import './planning.css';

const HORAIRES_PROPOSES: Horaires = { debut: '10:00', fin: '18:00', dureeMinutes: 120 };

/**
 * Le planning des présences d'une action : les horaires communs, les pôles (« Gaufres, 3 personnes
 * en même temps ») et la grille pôles × créneaux, avec les noms et les trous.
 */
export function PlanningDeLAction({ actionId }: { actionId: number }) {
  const planning = usePlanning(actionId);
  if (!planning.estCharge) return null;
  const tranches = planning.horaires ? tranchesDeLaJournee(planning.horaires) : [];
  const pris = (pole: number, heure: string) => planning.inscrits.filter((i) => i.pole_id === pole && i.debut === heure).length;
  const bilan = bilanDesPlaces(planning.poles, tranches, pris);
  return (
    <section className="drawer-section planning">
      <div className="section-head">
        <h3>Planning des présences</h3>
        {planning.poles.length > 0 && tranches.length > 0 && (
          <span className="muted small">{bilan.libres ? `${bilan.libres} place${bilan.libres > 1 ? 's' : ''} libre${bilan.libres > 1 ? 's' : ''} sur ${bilan.places}` : 'Tout est rempli'}</span>
        )}
      </div>
      {planning.horaires ? (
        <>
          <ReglagesDuPlanning planning={planning} horaires={planning.horaires} />
          <ListeDesPoles planning={planning} />
          {planning.poles.length > 0 && <GrilleDuPlanning planning={planning} tranches={tranches} dureeMinutes={planning.horaires.dureeMinutes} />}
        </>
      ) : (
        <DemarrerLePlanning onDemarrer={planning.enregistrerHoraires} />
      )}
    </section>
  );
}

/** Pas encore de planning : une phrase qui dit à quoi il sert, et des horaires proposés. */
function DemarrerLePlanning({ onDemarrer }: { onDemarrer: (h: Horaires) => void }) {
  return (
    <div className="planning-vide">
      <p className="muted small">Besoin de bras le jour J ? Découpez la journée en créneaux, ajoutez les pôles (stand, buvette…), puis ouvrez le planning aux membres pour qu’ils s’inscrivent depuis l’app.</p>
      <button className="primary" onClick={() => onDemarrer(HORAIRES_PROPOSES)}><Icon name="plus" size={15} /> Préparer un planning</button>
    </div>
  );
}

function ReglagesDuPlanning({ planning, horaires }: { planning: PlanningEtat; horaires: Horaires }) {
  const [brouillon, setBrouillon] = useState(horaires);
  const estModifie = brouillon.debut !== horaires.debut || brouillon.fin !== horaires.fin || brouillon.dureeMinutes !== horaires.dureeMinutes;
  const estValide = !!brouillon.debut && !!brouillon.fin && minutesDe(brouillon.fin) - minutesDe(brouillon.debut) >= brouillon.dureeMinutes;
  return (
    <div className="form">
      <div className="form-row planning-horaires">
        <label>De<input type="time" value={brouillon.debut} onChange={(e) => setBrouillon({ ...brouillon, debut: e.target.value })} /></label>
        <label>À<input type="time" value={brouillon.fin} onChange={(e) => setBrouillon({ ...brouillon, fin: e.target.value })} /></label>
        <label>Tranches de
          <select value={brouillon.dureeMinutes} onChange={(e) => setBrouillon({ ...brouillon, dureeMinutes: Number(e.target.value) })}>
            {DUREES_DE_TRANCHE.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`.replace('.5 h', ' h 30')}</option>)}
          </select>
        </label>
        {estModifie && <button className="primary" disabled={!estValide} onClick={() => planning.enregistrerHoraires(brouillon)}>Enregistrer les horaires</button>}
      </div>
      {estModifie && !estValide && <p className="small error">L’heure de fin doit laisser la place à au moins une tranche.</p>}
      <label className="switch">
        <input type="checkbox" checked={planning.ouvert} onChange={(e) => planning.basculerOuverture(e.target.checked)} />
        <span className="track" />
        <span><strong>Ouvert aux membres</strong><br /><span className="muted small">{planning.ouvert ? 'Les adhérents voient ce planning dans l’app et peuvent s’inscrire.' : 'Seul le bureau voit ce planning pour l’instant.'}</span></span>
      </label>
    </div>
  );
}

function ListeDesPoles({ planning }: { planning: PlanningEtat }) {
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
        <input value={nom} onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} placeholder="Ajouter un pôle… (Entrée)" aria-label="Nom du nouveau pôle" />
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
