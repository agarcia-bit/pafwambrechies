import { useState, type FocusEvent } from 'react';

import { besoinDuCreneau, estDejaPrisALHeure, type Pole } from '../creneaux';
import { Avatar, Icon } from '../Icon';
import type { Inscrit, PlanningEtat } from './usePlanning';

type Props = { pole: Pole; heure: string; planning: PlanningEtat; moi: string; libelle?: string };

/**
 * Un créneau d'un pôle, partagé par la vue par pôle (une ligne) et la grille (une case) : qui
 * vient, puis un seul état lisible (« Complet », « 2 places libres ») avec « Je viens » quand on
 * peut le prendre. Le reste (ajouter un nom, changer le nombre de places) est rangé dans le menu
 * « ⋯ », pour que rien ne déborde sur le créneau voisin.
 */
export function PlacesDuCreneau({ pole, heure, planning, moi, libelle }: Props) {
  const besoin = besoinDuCreneau(pole, heure);
  const inscrits = planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure);
  const libres = Math.max(0, besoin - inscrits.length);
  return (
    <div className={'creneau' + (besoin === 0 ? ' ferme' : libres ? ' manque' : ' rempli')}>
      {libelle && <span className="creneau-heure">{libelle}</span>}
      <div className="creneau-gens">
        {inscrits.map((inscrit) => <Personne key={inscrit.id} inscrit={inscrit} estMoi={inscrit.membre === moi} planning={planning} />)}
        {!inscrits.length && besoin > 0 && <span className="creneau-vide">Personne pour l’instant</span>}
      </div>
      <div className="creneau-etat">
        <EtatDuCreneau besoin={besoin} libres={libres} dejaPris={estDejaPrisALHeure(planning.inscrits, moi, heure)}
          onVenir={() => planning.jeViens(pole, heure, moi)} />
        <MenuDuCreneau pole={pole} heure={heure} besoin={besoin} planning={planning} />
      </div>
    </div>
  );
}

function EtatDuCreneau({ besoin, libres, dejaPris, onVenir }: { besoin: number; libres: number; dejaPris: boolean; onVenir: () => void }) {
  if (besoin === 0) return <span className="etat ferme">Pas besoin</span>;
  if (!libres) return <span className="etat rempli"><Icon name="check" size={13} /> Complet</span>;
  return (
    <>
      <span className="etat manque">{libres} place{libres > 1 ? 's' : ''} libre{libres > 1 ? 's' : ''}</span>
      {dejaPris
        ? <span className="etat-aide" title="Vous tenez déjà un poste à cette heure-là">Vous êtes ailleurs</span>
        : <button className="je-viens" onClick={onVenir}>Je viens</button>}
    </>
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
      <Avatar name={inscrit.nom} size={20} />
      {estMoi ? 'Vous' : inscrit.nom}
      <button className="personne-retirer" onClick={retirer} aria-label={estMoi ? 'Je ne peux plus venir' : `Retirer ${inscrit.nom}`}><Icon name="x" size={11} /></button>
    </span>
  );
}

/** Le menu « ⋯ » d'un créneau : ajouter un nom à la main, changer le nombre de places. */
function MenuDuCreneau({ pole, heure, besoin, planning }: { pole: Pole; heure: string; besoin: number; planning: PlanningEtat }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const [nom, setNom] = useState('');
  // Le menu se ferme dès que le focus en sort (clic ailleurs, touche Tab).
  const fermerSiDehors = (evenement: FocusEvent<HTMLDivElement>) => {
    if (!evenement.currentTarget.contains(evenement.relatedTarget as Node | null)) setEstOuvert(false);
  };
  function ajouter() {
    if (!nom.trim()) return;
    planning.ajouterUnNom(pole, heure, nom);
    setNom('');
    setEstOuvert(false);
  }
  return (
    <div className="creneau-menu" onBlur={fermerSiDehors}>
      <button className="icon-btn" aria-label={`Plus d’options pour ${pole.nom} à ${heure}`} aria-expanded={estOuvert} onClick={() => setEstOuvert(!estOuvert)}>
        <Icon name="dots" size={16} />
      </button>
      {estOuvert && (
        <div className="creneau-menu-panneau" role="dialog" aria-label="Options du créneau">
          <label className="small muted">Ajouter quelqu’un
            <span className="creneau-menu-ligne">
              <input autoFocus value={nom} placeholder="Prénom Nom" onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') ajouter(); if (e.key === 'Escape') setEstOuvert(false); }} />
              <button className="primary" disabled={!nom.trim()} onClick={ajouter}>Ajouter</button>
            </span>
          </label>
          <div className="creneau-menu-ligne">
            <span className="small muted">Places sur ce créneau</span>
            <span className="creneau-compteur">
              <button className="icon-btn" disabled={besoin === 0} onClick={() => planning.changerBesoin(pole, heure, besoin - 1)} aria-label="Une place de moins">−</button>
              <b>{besoin}</b>
              <button className="icon-btn" disabled={besoin >= 50} onClick={() => planning.changerBesoin(pole, heure, besoin + 1)} aria-label="Une place de plus">+</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
