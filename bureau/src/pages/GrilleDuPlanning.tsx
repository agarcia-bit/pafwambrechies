import { useState } from 'react';

import { besoinDuCreneau, etatDuCreneau, libelleDeTranche, type Pole } from '../creneaux';
import { Icon } from '../Icon';
import type { Inscrit, PlanningEtat } from './usePlanning';

type Props = { planning: PlanningEtat; tranches: string[]; dureeMinutes: number };

/** La grille du jour : une ligne par pôle, une colonne par tranche ; chaque case montre qui vient et ce qui manque. */
export function GrilleDuPlanning({ planning, tranches, dureeMinutes }: Props) {
  return (
    <div className="planning-grille-cadre">
      <table className="planning-grille">
        <thead>
          <tr>
            <th scope="col">Pôle</th>
            {tranches.map((heure) => <th key={heure} scope="col">{libelleDeTranche(heure, dureeMinutes)}</th>)}
          </tr>
        </thead>
        <tbody>
          {planning.poles.map((pole) => (
            <tr key={pole.id}>
              <th scope="row">{pole.nom}</th>
              {tranches.map((heure) => (
                <CaseDuPlanning key={heure} pole={pole} heure={heure} planning={planning}
                  inscrits={planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PropsDeCase = { pole: Pole; heure: string; inscrits: Inscrit[]; planning: PlanningEtat };

function CaseDuPlanning({ pole, heure, inscrits, planning }: PropsDeCase) {
  const besoin = besoinDuCreneau(pole, heure);
  const etat = etatDuCreneau({ besoin, pris: inscrits.length, estAMoi: false });
  return (
    <td className={'planning-case ' + etat}>
      <div className="planning-besoin">
        <button className="icon-btn" disabled={besoin === 0} onClick={() => planning.changerBesoin(pole, heure, besoin - 1)} aria-label={`Une personne de moins à ${heure} pour ${pole.nom}`}>−</button>
        <span aria-label={`${inscrits.length} inscrits sur ${besoin}`}>{inscrits.length}/{besoin}</span>
        <button className="icon-btn" disabled={besoin >= 50} onClick={() => planning.changerBesoin(pole, heure, besoin + 1)} aria-label={`Une personne de plus à ${heure} pour ${pole.nom}`}>+</button>
      </div>
      <ul className="planning-noms">
        {inscrits.map((i) => (
          <li key={i.id}>
            <span title={i.a_compte ? 'Inscrit depuis l’app' : 'Ajouté à la main'}>{i.nom}</span>
            <button className="icon-btn" onClick={() => confirm(`Retirer ${i.nom} de ce créneau ?`) && planning.retirerInscrit(i)} aria-label={`Retirer ${i.nom}`}><Icon name="x" size={12} /></button>
          </li>
        ))}
      </ul>
      {inscrits.length < besoin && <AjoutDUnNom onAjouter={(nom) => planning.ajouterUnNom(pole, heure, nom)} />}
    </td>
  );
}

/** Ajouter quelqu'un à la main (sans l'app, ou inscrit de vive voix). */
function AjoutDUnNom({ onAjouter }: { onAjouter: (nom: string) => void }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const [nom, setNom] = useState('');
  if (!estOuvert) return <button className="ghost small planning-ajout" onClick={() => setEstOuvert(true)}><Icon name="plus" size={12} /> Nom</button>;
  function valider() {
    if (nom.trim()) onAjouter(nom);
    setNom('');
    setEstOuvert(false);
  }
  return (
    <input className="planning-ajout-champ" autoFocus value={nom} placeholder="Prénom Nom" aria-label="Nom à ajouter"
      onChange={(e) => setNom(e.target.value)} onBlur={valider}
      onKeyDown={(e) => { if (e.key === 'Enter') valider(); if (e.key === 'Escape') { setNom(''); setEstOuvert(false); } }} />
  );
}
