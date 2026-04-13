import { useState, useRef, useEffect } from 'react';
import type { ShiftDefinition, DayIndex, EmployeeRole } from '../domain/types';
import { getShiftsForRole, formatShiftTime, getShiftHours } from '../domain/shifts';

interface ShiftCellProps {
  currentShift: ShiftDefinition | null;
  day: DayIndex;
  role: EmployeeRole;
  onChangeShift: (newShiftId: string) => void;
  onRemoveShift: () => void;
  onAddShift: (shiftId: string) => void;
}

export function ShiftCell({
  currentShift,
  day,
  role,
  onChangeShift,
  onRemoveShift,
  onAddShift,
}: ShiftCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const availableShifts = getShiftsForRole(role);

  if (!currentShift) {
    return (
      <div className="shift-cell shift-cell--empty" ref={ref}>
        <button
          className="shift-cell__add"
          onClick={() => setOpen(!open)}
          title="Ajouter un shift"
        >
          +
        </button>
        {open && (
          <div className="shift-cell__dropdown">
            {availableShifts.map((s) => (
              <button
                key={s.id}
                className="shift-cell__option"
                onClick={() => {
                  onAddShift(s.id);
                  setOpen(false);
                }}
              >
                {s.label} ({getShiftHours(s, day)}h)
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shift-cell" ref={ref}>
      <button
        className={`shift-cell__label shift-cell__label--${currentShift.service}`}
        onClick={() => setOpen(!open)}
        title="Cliquer pour modifier"
      >
        <span className="shift-cell__time">
          {formatShiftTime(currentShift, day)}
        </span>
        <span className="shift-cell__hours">
          {getShiftHours(currentShift, day)}h
        </span>
      </button>
      {open && (
        <div className="shift-cell__dropdown">
          {availableShifts
            .filter((s) => s.service === currentShift.service)
            .map((s) => (
              <button
                key={s.id}
                className={`shift-cell__option ${s.id === currentShift.id ? 'shift-cell__option--active' : ''}`}
                onClick={() => {
                  if (s.id !== currentShift.id) onChangeShift(s.id);
                  setOpen(false);
                }}
              >
                {s.label} ({getShiftHours(s, day)}h)
              </button>
            ))}
          <button
            className="shift-cell__option shift-cell__option--remove"
            onClick={() => {
              onRemoveShift();
              setOpen(false);
            }}
          >
            Retirer
          </button>
        </div>
      )}
    </div>
  );
}
