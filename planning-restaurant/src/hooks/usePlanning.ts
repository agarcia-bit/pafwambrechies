import { useState, useCallback, useMemo } from 'react';
import type {
  Employee,
  WeekConfig,
  ShiftAssignment,
  DayIndex,
  PlanningResult,
  ServiceType,
  DayConfig,
} from '../domain/types';
import { generatePlanning, recalculateAfterEdit } from '../domain/engine/planner';

export interface UsePlanningReturn {
  // State
  employees: Employee[];
  weekConfig: WeekConfig;
  assignments: ShiftAssignment[];
  result: PlanningResult;

  // Actions
  regenerate: () => void;
  updateShift: (empId: string, day: DayIndex, oldShiftId: string, newShiftId: string) => void;
  removeShift: (empId: string, day: DayIndex, service: ServiceType) => void;
  addShift: (empId: string, day: DayIndex, shiftId: string) => void;
  updateBaseRevenue: (value: number) => void;
  updateDayRevenuePct: (day: DayIndex, pct: number) => void;
  updateMinStaff: (day: DayIndex, service: ServiceType, value: number | null) => void;
  updateDefaultMinStaff: (service: ServiceType, value: number) => void;
}

export function usePlanning(
  initialEmployees: Employee[],
  initialWeekConfig: WeekConfig,
): UsePlanningReturn {
  const [employees] = useState(initialEmployees);
  const [weekConfig, setWeekConfig] = useState(initialWeekConfig);
  const [planResult, setPlanResult] = useState<PlanningResult>(() =>
    generatePlanning(initialEmployees, initialWeekConfig),
  );
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(
    () => planResult.assignments,
  );

  // Recompute summaries/productivity when assignments change
  const result = useMemo(() => {
    const recalc = recalculateAfterEdit(employees, assignments, weekConfig);
    return { ...recalc, assignments };
  }, [employees, assignments, weekConfig]);

  const regenerate = useCallback(() => {
    const res = generatePlanning(employees, weekConfig);
    setPlanResult(res);
    setAssignments(res.assignments);
  }, [employees, weekConfig]);

  const updateShift = useCallback(
    (empId: string, day: DayIndex, oldShiftId: string, newShiftId: string) => {
      setAssignments((prev) =>
        prev.map((a) =>
          a.employeeId === empId && a.day === day && a.shiftDefinitionId === oldShiftId
            ? { ...a, shiftDefinitionId: newShiftId }
            : a,
        ),
      );
    },
    [],
  );

  const removeShift = useCallback(
    (empId: string, day: DayIndex, _service: ServiceType) => {
      setAssignments((prev) =>
        prev.filter(
          (a) => !(a.employeeId === empId && a.day === day),
        ),
      );
    },
    [],
  );

  const addShift = useCallback(
    (empId: string, day: DayIndex, shiftId: string) => {
      setAssignments((prev) => [
        ...prev,
        { employeeId: empId, shiftDefinitionId: shiftId, day },
      ]);
    },
    [],
  );

  const updateBaseRevenue = useCallback((value: number) => {
    setWeekConfig((prev) => ({ ...prev, baseWeeklyRevenue: value }));
  }, []);

  const updateDayRevenuePct = useCallback((day: DayIndex, pct: number) => {
    setWeekConfig((prev) => ({
      ...prev,
      dayConfigs: prev.dayConfigs.map((dc: DayConfig) =>
        dc.day === day ? { ...dc, revenueAdjustmentPct: pct } : dc,
      ),
    }));
  }, []);

  const updateMinStaff = useCallback(
    (day: DayIndex, service: ServiceType, value: number | null) => {
      setWeekConfig((prev) => ({
        ...prev,
        dayConfigs: prev.dayConfigs.map((dc: DayConfig) =>
          dc.day === day
            ? {
                ...dc,
                ...(service === 'midi'
                  ? { minStaffMidi: value }
                  : { minStaffSoir: value }),
              }
            : dc,
        ),
      }));
    },
    [],
  );

  const updateDefaultMinStaff = useCallback(
    (service: ServiceType, value: number) => {
      setWeekConfig((prev) => ({
        ...prev,
        ...(service === 'midi'
          ? { defaultMinStaffMidi: value }
          : { defaultMinStaffSoir: value }),
      }));
    },
    [],
  );

  return {
    employees,
    weekConfig,
    assignments,
    result: { ...planResult, ...result },
    regenerate,
    updateShift,
    removeShift,
    addShift,
    updateBaseRevenue,
    updateDayRevenuePct,
    updateMinStaff,
    updateDefaultMinStaff,
  };
}
