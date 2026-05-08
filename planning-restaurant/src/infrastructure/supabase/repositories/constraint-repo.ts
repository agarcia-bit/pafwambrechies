import { freshQuery } from '../fresh-query'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'

// --- Unavailabilities ---

export async function fetchUnavailabilities(employeeId?: string): Promise<Unavailability[]> {
  const data = await freshQuery((c) => {
    let q = c.from('unavailabilities').select('*')
    if (employeeId) q = q.eq('employee_id', employeeId)
    return q.order('day_of_week')
  })
  return ((data as Record<string, unknown>[]) ?? []).map(mapUnavailability)
}

export async function createUnavailability(u: Omit<Unavailability, 'id'>): Promise<Unavailability> {
  const data = await freshQuery((c) =>
    c.from('unavailabilities').insert({
      employee_id: u.employeeId,
      type: u.type,
      day_of_week: u.dayOfWeek,
      specific_date: u.specificDate,
      available_from: u.availableFrom,
      available_until: u.availableUntil,
      label: u.label,
    }).select().single(),
  )
  return mapUnavailability(data as Record<string, unknown>)
}

export async function deleteUnavailability(id: string): Promise<void> {
  await freshQuery((c) => c.from('unavailabilities').delete().eq('id', id).select())
}

// --- Manager Fixed Schedules ---

export async function fetchManagerSchedules(employeeId?: string): Promise<ManagerFixedSchedule[]> {
  const data = await freshQuery((c) => {
    let q = c.from('manager_fixed_schedules').select('*')
    if (employeeId) q = q.eq('employee_id', employeeId)
    return q.order('day_of_week')
  })
  return ((data as Record<string, unknown>[]) ?? []).map(mapManagerSchedule)
}

export async function upsertManagerSchedule(s: Omit<ManagerFixedSchedule, 'id'>): Promise<ManagerFixedSchedule> {
  const data = await freshQuery((c) =>
    c.from('manager_fixed_schedules').upsert(
      {
        employee_id: s.employeeId,
        day_of_week: s.dayOfWeek,
        shift_template_id: s.shiftTemplateId,
        start_time: s.startTime,
        end_time: s.endTime,
      },
      { onConflict: 'employee_id,day_of_week' },
    ).select().single(),
  )
  return mapManagerSchedule(data as Record<string, unknown>)
}

// --- Conditional Availabilities ---

export async function fetchConditionalAvailabilities(employeeId?: string): Promise<ConditionalAvailability[]> {
  const data = await freshQuery((c) => {
    let q = c.from('conditional_availabilities').select('*')
    if (employeeId) q = q.eq('employee_id', employeeId)
    return q.order('day_of_week')
  })
  return ((data as Record<string, unknown>[]) ?? []).map(mapConditionalAvailability)
}

export async function createConditionalAvailability(ca: Omit<ConditionalAvailability, 'id'>): Promise<ConditionalAvailability> {
  const data = await freshQuery((c) =>
    c.from('conditional_availabilities').insert({
      employee_id: ca.employeeId,
      day_of_week: ca.dayOfWeek,
      allowed_shift_codes: ca.allowedShiftCodes,
      max_hours: ca.maxHours,
    }).select().single(),
  )
  return mapConditionalAvailability(data as Record<string, unknown>)
}

export async function deleteConditionalAvailability(id: string): Promise<void> {
  await freshQuery((c) => c.from('conditional_availabilities').delete().eq('id', id).select())
}

// --- Mappers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUnavailability(row: any): Unavailability {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    dayOfWeek: row.day_of_week,
    specificDate: row.specific_date,
    availableFrom: row.available_from != null ? Number(row.available_from) : null,
    availableUntil: row.available_until != null ? Number(row.available_until) : null,
    label: row.label,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapManagerSchedule(row: any): ManagerFixedSchedule {
  return {
    id: row.id,
    employeeId: row.employee_id,
    dayOfWeek: row.day_of_week,
    shiftTemplateId: row.shift_template_id,
    startTime: row.start_time != null ? Number(row.start_time) : null,
    endTime: row.end_time != null ? Number(row.end_time) : null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConditionalAvailability(row: any): ConditionalAvailability {
  return {
    id: row.id,
    employeeId: row.employee_id,
    dayOfWeek: row.day_of_week,
    allowedShiftCodes: row.allowed_shift_codes,
    maxHours: row.max_hours != null ? Number(row.max_hours) : null,
  }
}
