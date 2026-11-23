import { useState } from 'react';

import { besoinDuCreneau, estDejaPrisALHeure, libelleDeTranche, type Pole, type Trou } from '../creneaux';
import { Icon } from '../Icon';
import { CaseDuCreneau, ChoixDUnePlace } from './PlacesDuCreneau';
import type { PlanningEtat } from './usePlanning';

type Props = { planning: PlanningEtat; tranches: string[]; moi: string };

/** Combien de places un pôle offre sur la journée, et combien sont prises : pour sa jauge. */
function remplissage(pole: Pole, tranches: string[], planning: PlanningEtat) {
  const places = tranches.reduce((total, heure) => total + besoinDuCreneau(pole, heure), 0);
  const prises = tranches.reduce((total, heure) =>
    total + Math.min(besoinDuCreneau(pole, heure), planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure).length), 0);
  return { places, prises, estBien: places > 0 && prises >= places };
}

function Jauge({ pole, tranches, planning }: { pole: Pole; tranches: string[]; planning: PlanningEtat }) {
  const { places, prises, estBien } = remplissage(pole, tranches, planning);
  return (
    <>
      <div className="jauge-titre"><span className="jauge-nom">{pole.nom}</span><span className={'jauge-chiffre' + (estBien ? ' bien' : '')}>{prises}/{places}</span></div>
      <div className="jauge" role="img" aria-label={`${prises} places prises sur ${places}`}>
        <div className={estBien ? 'bien' : ''} style={{ width: `${places ? Math.round((prises / places) * 100) : 0}%` }} />
      </div>
    </>
  );
}

/** Tout le planning en grille : les heures en lignes, les pôles en colonnes, la colonne des heures reste visible. */
export function GrilleDuPlanning({ planning, tranches, moi }: Props) {
  const duree = planning.horaires?.dureeMinutes ?? 60;
  return (
    <div className="grille-planning" style={{ '--nb-poles': planning.poles.length } as React.CSSProperties}>
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Horaire</span></th>
            {planning.poles.map((pole) => <th key={pole.id} scope="col"><Jauge pole={pole} tranches={tranches} planning={planning} /></th>)}
          </tr>
        </thead>
        <tbody>
          {tranches.map((heure) => (
            <tr key={heure}>
              <th scope="row">{libelleDeTranche(heure, duree)}</th>
              {planning.poles.map((pole) => {
                const besoin = besoinDuCreneau(pole, heure);
                const pris = planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure).length;
                return (
                  <td key={pole.id} className={besoin === 0 ? 'ferme' : pris >= besoin ? 'plein' : ''}>
                    <CaseDuCreneau pole={pole} heure={heure} planning={planning} moi={moi} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Les créneaux en liste (ce qui manque, ou tout sur téléphone) : une ligne par créneau, « Je viens » s'il reste une place. */
export function ListeDesTrous({ trous, planning, moi }: { trous: Trou[]; planning: PlanningEtat; moi: string }) {
  if (!trous.length) return <div className="trous-vide">Tout est rempli. Merci à tous !</div>;
  return (
    <ul className="liste-trous">
      {trous.map((trou) => <LigneDeTrou key={`${trou.pole.id}-${trou.heure}`} trou={trou} planning={planning} moi={moi} />)}
    </ul>
  );
}

function LigneDeTrou({ trou, planning, moi }: { trou: Trou; planning: PlanningEtat; moi: string }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const dejaPris = estDejaPrisALHeure(planning.inscrits, moi, trou.heure);
  return (
    <li className="trou">
      <div className="trou-quoi">
        <b>{trou.pole.nom} · {libelleDeTranche(trou.heure, planning.horaires?.dureeMinutes ?? 60)}</b>
        <span>{trou.presents.length ? `Avec ${trou.presents.join(', ')}` : 'Personne pour l’instant'}</span>
      </div>
      {trou.manque
        ? <span className="trou-manque">{trou.manque} place{trou.manque > 1 ? 's' : ''}</span>
        : <span className="trou-complet">Complet</span>}
      {trou.manque > 0 && (dejaPris
        ? <button onClick={() => setEstOuvert(true)}>Ajouter un nom</button>
        : <button onClick={() => planning.jeViens(trou.pole, trou.heure, moi)}>Je viens</button>)}
      <button className="icon-btn trou-plus" aria-label={`Autres choix pour ${trou.pole.nom}, ${libelleDeTranche(trou.heure, planning.horaires?.dureeMinutes ?? 60)}`} onClick={() => setEstOuvert(true)}><Icon name="dots" size={16} /></button>
      {estOuvert && <ChoixDUnePlace pole={trou.pole} heure={trou.heure} planning={planning} moi={moi} onFermer={() => setEstOuvert(false)} />}
    </li>
  );
}
