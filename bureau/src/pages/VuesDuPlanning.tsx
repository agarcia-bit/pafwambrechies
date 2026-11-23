import { besoinDuCreneau, libelleDeTranche, type Pole } from '../creneaux';
import { PlacesDuCreneau } from './PlacesDuCreneau';
import type { PlanningEtat } from './usePlanning';

type Props = { planning: PlanningEtat; tranches: string[]; dureeMinutes: number; moi: string };

/** Combien de places un pôle offre sur la journée, et combien sont prises : pour sa jauge. */
function remplissage(pole: Pole, tranches: string[], planning: PlanningEtat) {
  const places = tranches.reduce((total, heure) => total + besoinDuCreneau(pole, heure), 0);
  const prises = tranches.reduce((total, heure) =>
    total + Math.min(besoinDuCreneau(pole, heure), planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure).length), 0);
  return { places, prises, estBien: places > 0 && prises / places >= 0.75 };
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

/** Vue par pôle : une carte par pôle, sa jauge, puis une colonne par tranche. */
export function VueParPole({ planning, tranches, dureeMinutes, moi }: Props) {
  return (
    <div className="vue-poles">
      {planning.poles.map((pole) => (
        <article key={pole.id} className="carte-pole">
          <Jauge pole={pole} tranches={tranches} planning={planning} />
          <div className="carte-pole-tranches" style={{ gridTemplateColumns: `repeat(${Math.min(tranches.length, 4)}, minmax(0, 1fr))` }}>
            {tranches.map((heure) => (
              <PlacesDuCreneau key={heure} pole={pole} heure={heure} planning={planning} moi={moi} libelle={libelleDeTranche(heure, dureeMinutes)} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Vue en grille : les heures en lignes, les pôles en colonnes. */
export function VueEnGrille({ planning, tranches, dureeMinutes, moi }: Props) {
  return (
    <div className="vue-grille">
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
              <th scope="row">{libelleDeTranche(heure, dureeMinutes)}</th>
              {planning.poles.map((pole) => (
                <td key={pole.id}><PlacesDuCreneau pole={pole} heure={heure} planning={planning} moi={moi} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
