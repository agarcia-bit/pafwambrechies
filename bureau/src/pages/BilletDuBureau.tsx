import { billetsDeLaPersonne, libelleDeTranche } from '../creneaux';
import type { PlanningEtat } from './usePlanning';

type Props = { planning: PlanningEtat; moi: string; dureeMinutes: number; dateLongue: string };

/**
 * Les créneaux du membre du bureau connecté, en billets, comme dans l'app (DESIGN.md,
 * « Créneaux de présence ») : ce qu'il doit faire passe avant le reste du planning.
 */
export function BilletsDuBureau({ planning, moi, dureeMinutes, dateLongue }: Props) {
  const billets = billetsDeLaPersonne(planning.poles, planning.inscrits, moi);
  return billets.map(({ inscrit, nomDuPole, avec }) => {
    function seRetirer() {
      if (confirm('Vous ne pouvez plus venir sur ce créneau ? La place redeviendra libre.')) planning.jeMeRetire(inscrit);
    }
    return (
      <div key={inscrit.id} className="billet">
        <div className="billet-gauche">
          <div className="billet-sur-titre">Votre créneau · {dateLongue}</div>
          <div className="billet-heure">{libelleDeTranche(inscrit.debut, dureeMinutes)}</div>
          <div className="billet-pole">{nomDuPole} · {avec.length ? `avec ${avec.join(', ')}` : 'personne d’autre pour l’instant'}</div>
        </div>
        <div className="billet-droite">
          <span>Rappel la veille</span>
          <button className="billet-lien" onClick={seRetirer}>Je ne peux plus venir</button>
        </div>
      </div>
    );
  });
}
