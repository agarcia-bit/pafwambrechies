import { type EtatDesBenevoles } from '../accueil-benevoles';
import { Empty, Icon, Skeleton } from '../Icon';
import { formatDay } from '../lib';
import { adresseDuPlanning } from './PlanningDeLAction';

/** La carte « Bénévoles » de la vue d'ensemble : prochaine action, pointage en retard, bilan de l'année. */
export function BenevolesDeLAccueil({ etat, enChargement }: { etat: EtatDesBenevoles | null; enChargement: boolean }) {
  return (
    <section className="card">
      <div className="head"><h2>Bénévoles</h2><a href="#benevoles">Voir le bilan →</a></div>
      {enChargement && !etat ? <Skeleton lines={3} /> : !etat ? <Empty icon="users" title="Pas encore de planning" /> : (
        <ul className="plain">
          {etat.prochaine && (
            <li>
              <a className="row-link" href={adresseDuPlanning(etat.prochaine.id)}>
                <span className={'tile ' + (etat.prochaine.manque ? 'warn' : 'ok')}><Icon name="calendar" size={16} /></span>
                <span className="grow">{etat.prochaine.emoji ? `${etat.prochaine.emoji} ` : ''}{etat.prochaine.titre}<span className="muted small"> · {formatDay(etat.prochaine.date)}</span></span>
                <span className={etat.prochaine.manque ? 'badge warn' : 'badge ok'}>{etat.prochaine.manque ? `il manque ${etat.prochaine.manque}` : 'complet'}</span>
              </a>
            </li>
          )}
          {etat.aPointer && (
            <li>
              <a className="row-link" href={adresseDuPlanning(etat.aPointer.id)}>
                <span className="tile info"><Icon name="check" size={16} /></span>
                <span className="grow">{etat.aPointer.titre}<span className="muted small"> · à pointer</span></span>
                <span className="badge info">{etat.aPointer.aPointer} à pointer</span>
              </a>
            </li>
          )}
          <li>
            <a className="row-link" href="#benevoles">
              <span className="tile brand"><Icon name="users" size={16} /></span>
              <span className="grow">{etat.benevoles} bénévole{etat.benevoles > 1 ? 's' : ''} cette année</span>
              <span className="muted small">{etat.creneaux} créneau{etat.creneaux > 1 ? 'x' : ''} tenu{etat.creneaux > 1 ? 's' : ''}</span>
            </a>
          </li>
        </ul>
      )}
    </section>
  );
}
