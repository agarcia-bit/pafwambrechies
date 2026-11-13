import { Icon } from '../Icon';
import { formatDay, today } from '../lib';
import { MODELES, brouillonDepuisModele, brouillonPourEvenement, type BrouillonAction } from '../modeles-actions';
import type { CalEvent } from './PilotageViews';

/**
 * Le Pilotage encore vide : plutôt qu'une page blanche, ce à quoi il sert et trois façons de
 * commencer (un événement de l'agenda à préparer, un modèle, ou une action libre).
 */
export function DemarrerLePilotage({ evenements, onCommencer }: { evenements: CalEvent[]; onCommencer: (brouillon: BrouillonAction | null) => void }) {
  const aVenir = evenements.filter((e) => e.date >= today()).slice(0, 3);
  return (
    <section className="card demarrer">
      <h2>Par quoi commencer ?</h2>
      <p className="muted">
        Une action, c’est un projet du bureau : un événement à organiser, une assemblée générale, une campagne…
        Elle a sa liste de tâches, pour savoir qui fait quoi et pour quand.
      </p>
      {aVenir.length > 0 && (
        <>
          <h3 className="sect">Vos prochains événements</h3>
          <div className="demarrer-choix">
            {aVenir.map((e) => (
              <button key={e.id} className="demarrer-carte" onClick={() => onCommencer(brouillonPourEvenement(e, today()))}>
                <span className="demarrer-emoji">🎉</span>
                <span className="grow"><strong>Préparer : {e.titre}</strong><small>{formatDay(e.date)} · la liste de préparation est déjà prête</small></span>
                <Icon name="right" size={16} />
              </button>
            ))}
          </div>
        </>
      )}
      <h3 className="sect">Partir d’un modèle</h3>
      <div className="demarrer-choix">
        {MODELES.map((m) => (
          <button key={m.cle} className="demarrer-carte" onClick={() => onCommencer(brouillonDepuisModele(m, today(), today()))}>
            <span className="demarrer-emoji">{m.emoji}</span>
            <span className="grow"><strong>{m.titre}</strong><small>{m.taches.length} tâches · {m.resume}</small></span>
            <Icon name="right" size={16} />
          </button>
        ))}
        <button className="demarrer-carte" onClick={() => onCommencer(null)}>
          <span className="demarrer-emoji">📌</span>
          <span className="grow"><strong>Partir de zéro</strong><small>Une action libre, avec vos propres tâches</small></span>
          <Icon name="right" size={16} />
        </button>
      </div>
    </section>
  );
}
