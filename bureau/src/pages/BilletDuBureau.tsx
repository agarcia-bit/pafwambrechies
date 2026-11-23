import { billetsDeLaPersonne, libelleDeTranche } from '../creneaux';
import type { PlanningEtat } from './usePlanning';

type Props = { planning: PlanningEtat; moi: string; dureeMinutes: number };

/**
 * Les créneaux du membre du bureau connecté, en billets compacts sur une ligne (DESIGN.md,
 * « Créneaux de présence ») : ce qu'il s'est engagé à faire, sans prendre la place du planning.
 */
export function BilletsDuBureau({ planning, moi, dureeMinutes }: Props) {
  const billets = billetsDeLaPersonne(planning.poles, planning.inscrits, moi);
  return billets.map(({ inscrit, nomDuPole, avec }) => {
    function seRetirer() {
      if (confirm('Vous ne pouvez plus venir sur ce créneau ? La place redeviendra libre.')) planning.jeMeRetire(inscrit);
    }
    return (
      <div key={inscrit.id} className="billet">
        <div className="billet-gauche">
          <div className="billet-sur-titre">Votre créneau</div>
          <div className="billet-heure">{nomDuPole} · {libelleDeTranche(inscrit.debut, dureeMinutes)}</div>
          {avec.length > 0 && <div className="billet-avec">avec {avec.join(', ')}</div>}
        </div>
        <button className="billet-lien" onClick={seRetirer}>Je ne peux plus venir</button>
      </div>
    );
  });
}
