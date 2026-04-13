import type { WeekConfig, DayIndex, ServiceType } from '../domain/types';
import { DAY_LABELS, ALL_DAYS } from '../domain/types';

interface Props {
  weekConfig: WeekConfig;
  onMinStaffChange: (day: DayIndex, service: ServiceType, value: number | null) => void;
  onDefaultChange: (service: ServiceType, value: number) => void;
}

export function MinStaffOverride({
  weekConfig,
  onMinStaffChange,
  onDefaultChange,
}: Props) {
  return (
    <div className="min-staff-override">
      <h3>Effectifs minimum par jour</h3>

      <div className="min-staff-override__defaults">
        <label>
          Défaut midi
          <input
            type="number"
            min={0}
            max={20}
            value={weekConfig.defaultMinStaffMidi}
            onChange={(e) => onDefaultChange('midi', Number(e.target.value))}
          />
        </label>
        <label>
          Défaut soir
          <input
            type="number"
            min={0}
            max={20}
            value={weekConfig.defaultMinStaffSoir}
            onChange={(e) => onDefaultChange('soir', Number(e.target.value))}
          />
        </label>
      </div>

      <table className="min-staff-override__table">
        <thead>
          <tr>
            <th></th>
            {ALL_DAYS.map((d) => (
              <th key={d}>{DAY_LABELS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['midi', 'soir'] as ServiceType[]).map((service) => (
            <tr key={service}>
              <td className="min-staff-override__service">
                {service === 'midi' ? 'Midi' : 'Soir'}
              </td>
              {ALL_DAYS.map((day) => {
                const dc = weekConfig.dayConfigs.find((c) => c.day === day);
                const val =
                  service === 'midi' ? dc?.minStaffMidi : dc?.minStaffSoir;
                const defaultVal =
                  service === 'midi'
                    ? weekConfig.defaultMinStaffMidi
                    : weekConfig.defaultMinStaffSoir;

                return (
                  <td key={day}>
                    <input
                      type="number"
                      className="min-staff-override__input"
                      min={0}
                      max={20}
                      placeholder={String(defaultVal)}
                      value={val ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        onMinStaffChange(
                          day,
                          service,
                          raw === '' ? null : Number(raw),
                        );
                      }}
                    />
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
