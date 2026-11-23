import { useState } from 'react';

import { besoinDuCreneau, estDejaPrisALHeure, placesDuCreneau, type Pole } from '../creneaux';
import { Avatar, Icon } from '../Icon';
import type { Inscrit, PlanningEtat } from './usePlanning';

type Props = { pole: Pole; heure: string; planning: PlanningEtat; moi: string; libelle?: string };

/**
 * Les places d'un créneau, partagées par la vue par pôle et la grille : chaque inscrit avec son
 * nom (« Vous » pour soi), chaque place libre en pointillés « + Je viens ». Le nombre de places
 * et l'ajout d'un nom à la main apparaissent au survol, pour ne pas charger la vue.
 */
export function PlacesDuCreneau({ pole, heure, planning, moi, libelle }: Props) {
  const besoin = besoinDuCreneau(pole, heure);
  const inscrits = planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure);
  const dejaPris = estDejaPrisALHeure(planning.inscrits, moi, heure);
  return (
    <div className={'places' + (inscrits.length >= besoin ? ' rempli' : ' manque') + (besoin === 0 ? ' ferme' : '')}>
      {/* L'horaire et les outils sur la même ligne : les outils n'ajoutent pas de hauteur. */}
      <div className="places-tete">
        {libelle && <span className="muted small tranche">{libelle}</span>}
        <div className="places-outils">
          <AjoutDUnNom onAjouter={(nom) => planning.ajouterUnNom(pole, heure, nom)} />
          <span className="places-besoin">
            <button className="icon-btn" disabled={besoin === 0} onClick={() => planning.changerBesoin(pole, heure, besoin - 1)} aria-label={`Une place de moins à ${heure} pour ${pole.nom}`}>−</button>
            <span>{besoin}</span>
            <button className="icon-btn" disabled={besoin >= 50} onClick={() => planning.changerBesoin(pole, heure, besoin + 1)} aria-label={`Une place de plus à ${heure} pour ${pole.nom}`}>+</button>
          </span>
        </div>
      </div>
      {placesDuCreneau(besoin, inscrits).map((inscrit, rang) => inscrit
        ? <Personne key={inscrit.id} inscrit={inscrit} estMoi={inscrit.membre === moi} planning={planning} />
        : <PlaceLibre key={`libre-${rang}`} dejaPris={dejaPris} onVenir={() => planning.jeViens(pole, heure, moi)} />)}
      {besoin === 0 && <span className="muted small">Pas besoin</span>}
    </div>
  );
}

function Personne({ inscrit, estMoi, planning }: { inscrit: Inscrit; estMoi: boolean; planning: PlanningEtat }) {
  function retirer() {
    if (estMoi) {
      if (confirm('Vous ne pouvez plus venir sur ce créneau ? La place redeviendra libre.')) planning.jeMeRetire(inscrit);
    } else if (confirm(`Retirer ${inscrit.nom} de ce créneau ?`)) planning.retirerInscrit(inscrit);
  }
  return (
    <span className={'personne' + (estMoi ? ' moi' : '')} title={inscrit.a_compte ? 'Inscrit depuis l’app ou l’espace bureau' : 'Ajouté à la main'}>
      <Avatar name={inscrit.nom} size={22} />
      {estMoi ? 'Vous' : inscrit.nom}
      <button className="personne-retirer" onClick={retirer} aria-label={estMoi ? 'Je ne peux plus venir' : `Retirer ${inscrit.nom}`}><Icon name="x" size={11} /></button>
    </span>
  );
}

/** Une place libre : on la prend soi-même, sauf si l'on tient déjà un poste à cette heure-là. */
function PlaceLibre({ dejaPris, onVenir }: { dejaPris: boolean; onVenir: () => void }) {
  if (dejaPris) return <span className="place-libre attente">Place libre</span>;
  return <button className="place-libre" onClick={onVenir}>+ Je viens</button>;
}

/** Ajouter quelqu'un à la main (sans l'app, ou inscrit de vive voix). */
function AjoutDUnNom({ onAjouter }: { onAjouter: (nom: string) => void }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const [nom, setNom] = useState('');
  if (!estOuvert) return <button className="link small" onClick={() => setEstOuvert(true)}>+ Nom</button>;
  function valider() {
    if (nom.trim()) onAjouter(nom);
    setNom('');
    setEstOuvert(false);
  }
  return (
    <input className="places-champ" autoFocus value={nom} placeholder="Prénom Nom" aria-label="Nom à ajouter"
      onChange={(e) => setNom(e.target.value)} onBlur={valider}
      onKeyDown={(e) => { if (e.key === 'Enter') valider(); if (e.key === 'Escape') { setNom(''); setEstOuvert(false); } }} />
  );
}
