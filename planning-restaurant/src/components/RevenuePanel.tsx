import type { WeekConfig, DayIndex } from '../domain/types';
import { DAY_LABELS, ALL_DAYS } from '../domain/types';

interface Props {
  weekConfig: WeekConfig;
  onBaseRevenueChange: (value: number) => void;
  onDayPctChange: (day: DayIndex, pct: number) => void;
}

export function RevenuePanel({
  weekConfig,
  onBaseRevenueChange,
  onDayPctChange,
}: Props) {
  const baseDailyRevenue = weekConfig.baseWeeklyRevenue / 7;

  return (
    <div className="revenue-panel">
      <h3>CA prévisionnel</h3>

      <div className="revenue-panel__base">
        <label>
          CA cible semaine (€)
          <input
            type="number"
            value={weekConfig.baseWeeklyRevenue}
            onChange={(e) => onBaseRevenueChange(Number(e.target.value))}
            step={500}
            min={0}
          />
        </label>
        <span className="revenue-panel__daily-avg">
          Base jour : {baseDailyRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
        </span>
      </div>

      <div className="revenue-panel__days">
        {ALL_DAYS.map((day) => {
          const dc = weekConfig.dayConfigs.find((c) => c.day === day);
          const pct = dc?.revenueAdjustmentPct ?? 0;
          const dayRevenue = baseDailyRevenue * (1 + pct / 100);

          return (
            <div key={day} className="revenue-panel__day">
              <span className="revenue-panel__day-label">{DAY_LABELS[day]}</span>
              <div className="revenue-panel__day-adjust">
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={pct}
                  onChange={(e) => onDayPctChange(day, Number(e.target.value))}
                />
                <span className={`revenue-panel__pct ${pct >= 0 ? 'positive' : 'negative'}`}>
                  {pct >= 0 ? '+' : ''}{pct}%
                </span>
              </div>
              <span className="revenue-panel__day-amount">
                {dayRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
