import type { ProductivityMetrics } from '../domain/types';

interface Props {
  metrics: ProductivityMetrics;
}

export function ProductivityIndicator({ metrics }: Props) {
  const {
    totalScheduledHours,
    weeklyRevenueTarget,
    revenuePerHour,
    recruitmentNeeded,
    recommendedExtraHours,
    productivityRating,
  } = metrics;

  const ratingColors: Record<string, string> = {
    low: '#e67e22',
    ok: '#27ae60',
    high: '#e74c3c',
  };

  const ratingLabels: Record<string, string> = {
    low: 'Sur-effectif',
    ok: 'Équilibré',
    high: 'Sous-effectif',
  };

  return (
    <div className="productivity-indicator">
      <h3>Productivité semaine</h3>
      <div className="productivity-indicator__grid">
        <div className="productivity-indicator__metric">
          <span className="productivity-indicator__value">
            {totalScheduledHours.toFixed(1)}h
          </span>
          <span className="productivity-indicator__label">Heures planifiées</span>
        </div>
        <div className="productivity-indicator__metric">
          <span className="productivity-indicator__value">
            {weeklyRevenueTarget.toLocaleString('fr-FR')}€
          </span>
          <span className="productivity-indicator__label">CA cible semaine</span>
        </div>
        <div className="productivity-indicator__metric">
          <span
            className="productivity-indicator__value"
            style={{ color: ratingColors[productivityRating] }}
          >
            {revenuePerHour.toFixed(1)}€/h
          </span>
          <span className="productivity-indicator__label">CA / heure</span>
        </div>
        <div className="productivity-indicator__metric">
          <span
            className="productivity-indicator__badge"
            style={{
              backgroundColor: ratingColors[productivityRating],
            }}
          >
            {ratingLabels[productivityRating]}
          </span>
        </div>
      </div>
      {recruitmentNeeded && (
        <div className="productivity-indicator__alert">
          Recrutement recommandé : +{recommendedExtraHours}h/semaine nécessaires
          pour atteindre l'objectif de productivité
        </div>
      )}
    </div>
  );
}
