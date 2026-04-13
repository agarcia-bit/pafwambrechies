import type {
  Employee,
  ShiftAssignment,
  DayIndex,
  EmployeeRole,
  EmployeeWeekSummary,
  ServiceType,
  WeekConfig,
} from '../domain/types';
import { DAY_LABELS, ALL_DAYS } from '../domain/types';
import { getShiftById, getShiftsForRole } from '../domain/shifts';
import { ShiftCell } from './ShiftCell';

interface Props {
  role: EmployeeRole;
  employees: Employee[];
  assignments: ShiftAssignment[];
  summaries: EmployeeWeekSummary[];
  weekConfig: WeekConfig;
  onChangeShift: (empId: string, day: DayIndex, oldShiftId: string, newShiftId: string) => void;
  onRemoveShift: (empId: string, day: DayIndex, service: ServiceType) => void;
  onAddShift: (empId: string, day: DayIndex, shiftId: string) => void;
}

export function WeeklyGrid({
  role,
  employees,
  assignments,
  summaries,
  weekConfig,
  onChangeShift,
  onRemoveShift,
  onAddShift,
}: Props) {
  const roleEmployees = employees.filter((e) => e.role === role);
  const baseDailyRevenue = weekConfig.baseWeeklyRevenue / 7;

  // Count staff per day/service
  const staffCount = (day: DayIndex, service: ServiceType): number => {
    return assignments.filter((a) => {
      if (a.day !== day) return false;
      const emp = employees.find((e) => e.id === a.employeeId);
      if (!emp || emp.role !== role) return false;
      const shift = getShiftById(a.shiftDefinitionId);
      return shift?.service === service;
    }).length;
  };

  return (
    <div className="weekly-grid">
      <table className="weekly-grid__table">
        <thead>
          <tr>
            <th className="weekly-grid__emp-header">Employé</th>
            {ALL_DAYS.map((day) => {
              const dc = weekConfig.dayConfigs.find((c) => c.day === day);
              const pct = dc?.revenueAdjustmentPct ?? 0;
              const dayRevenue = baseDailyRevenue * (1 + pct / 100);

              return (
                <th key={day} className="weekly-grid__day-header">
                  <div>{DAY_LABELS[day]}</div>
                  <div className="weekly-grid__day-ca">
                    {dayRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
                  </div>
                  <div className="weekly-grid__day-staff">
                    M:{staffCount(day, 'midi')} / S:{staffCount(day, 'soir')}
                  </div>
                </th>
              );
            })}
            <th className="weekly-grid__total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {roleEmployees.map((emp) => {
            const summary = summaries.find((s) => s.employeeId === emp.id);

            return (
              <tr key={emp.id} className={summary?.belowContract ? 'weekly-grid__row--warning' : ''}>
                <td className="weekly-grid__emp-name">
                  <div>{emp.firstName} {emp.lastName}</div>
                  <div className="weekly-grid__contract">
                    Contrat : {emp.contractHours}h
                  </div>
                </td>
                {ALL_DAYS.map((day) => {
                  const dayAssignments = assignments.filter(
                    (a) => a.employeeId === emp.id && a.day === day,
                  );

                  const hasShifts = getShiftsForRole(role);
                  const midiAssignment = dayAssignments.find((a) => {
                    const s = getShiftById(a.shiftDefinitionId);
                    return s?.service === 'midi';
                  });
                  const soirAssignment = dayAssignments.find((a) => {
                    const s = getShiftById(a.shiftDefinitionId);
                    return s?.service === 'soir';
                  });

                  const available = emp.availability[day] ?? [];

                  if (available.length === 0) {
                    return (
                      <td key={day} className="weekly-grid__cell weekly-grid__cell--unavailable">
                        <span className="weekly-grid__off">Repos</span>
                      </td>
                    );
                  }

                  return (
                    <td key={day} className="weekly-grid__cell">
                      {available.includes('midi') && hasShifts.some((s) => s.service === 'midi') && (
                        <ShiftCell
                          currentShift={midiAssignment ? getShiftById(midiAssignment.shiftDefinitionId) ?? null : null}
                          day={day}
                          role={role}
                          onChangeShift={(newId) =>
                            midiAssignment && onChangeShift(emp.id, day, midiAssignment.shiftDefinitionId, newId)
                          }
                          onRemoveShift={() => onRemoveShift(emp.id, day, 'midi')}
                          onAddShift={(shiftId) => onAddShift(emp.id, day, shiftId)}
                        />
                      )}
                      {available.includes('soir') && hasShifts.some((s) => s.service === 'soir') && (
                        <ShiftCell
                          currentShift={soirAssignment ? getShiftById(soirAssignment.shiftDefinitionId) ?? null : null}
                          day={day}
                          role={role}
                          onChangeShift={(newId) =>
                            soirAssignment && onChangeShift(emp.id, day, soirAssignment.shiftDefinitionId, newId)
                          }
                          onRemoveShift={() => onRemoveShift(emp.id, day, 'soir')}
                          onAddShift={(shiftId) => onAddShift(emp.id, day, shiftId)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="weekly-grid__total-cell">
                  <span
                    className={`weekly-grid__hours ${
                      summary?.belowContract
                        ? 'weekly-grid__hours--under'
                        : summary && summary.delta > 0
                          ? 'weekly-grid__hours--over'
                          : ''
                    }`}
                  >
                    {summary?.scheduledHours.toFixed(1)}h
                  </span>
                  {summary && summary.delta !== 0 && (
                    <span
                      className={`weekly-grid__delta ${
                        summary.delta > 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {summary.delta > 0 ? '+' : ''}
                      {summary.delta.toFixed(1)}h
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
