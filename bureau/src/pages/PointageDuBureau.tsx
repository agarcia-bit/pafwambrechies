import { phraseDuPointage, presenceApres, resumeDuPointage, tranchesAPointer, type Presence } from '../pointage';
import type { Inscrit, PlanningEtat } from './usePlanning';

/**
 * Le pointage depuis l'ordinateur, le jour J ou après coup : qui est vraiment venu, rangé par
 * heure. Recliquer sur le bouton choisi annule ; sans pointage, la personne compte comme venue.
 */
export function PointageDuBureau({ planning, dureeMinutes }: { planning: PlanningEtat; dureeMinutes: number }) {
  if (!planning.inscrits.length) return null;
  return (
    <section className="card pointage" aria-labelledby="titre-pointage">
      <div className="head">
        <div>
          <h2 id="titre-pointage">Pointage</h2>
          <span className="muted small" aria-live="polite">{phraseDuPointage(resumeDuPointage(planning.inscrits))}</span>
        </div>
      </div>
      {tranchesAPointer(planning, dureeMinutes).map((tranche) => (
        <div key={tranche.heure} className="pointage-tranche">
          <h3 className="small muted">{tranche.libelle}</h3>
          <ul>
            {tranche.inscrits.map(({ inscrit, nomDuPole }) => (
              <LigneDePointage key={inscrit.id} inscrit={inscrit} nomDuPole={nomDuPole}
                onChoisir={(choix) => planning.pointer(inscrit, presenceApres(inscrit.presence, choix))} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function LigneDePointage({ inscrit, nomDuPole, onChoisir }: { inscrit: Inscrit; nomDuPole: string; onChoisir: (choix: Presence) => void }) {
  return (
    <li className="pointage-ligne">
      <span className="grow"><strong>{inscrit.nom}</strong> <span className="muted small">· {nomDuPole}</span></span>
      <button className={'pointage-venu' + (inscrit.presence === 'venu' ? ' on' : '')} aria-pressed={inscrit.presence === 'venu'} onClick={() => onChoisir('venu')}>Venu</button>
      <button className={'pointage-absent' + (inscrit.presence === 'absent' ? ' on' : '')} aria-pressed={inscrit.presence === 'absent'} onClick={() => onChoisir('absent')}>Absent</button>
    </li>
  );
}
