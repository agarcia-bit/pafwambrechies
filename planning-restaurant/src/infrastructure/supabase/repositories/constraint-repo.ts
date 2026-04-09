import { supabase } from '../client'
import type { Unavailability, ManagerFixedSchedule, ConditionalAvailability } from '@/domain/models/constraint'

// --- Unavailabilities ---

export async function fetchUnavailabilities(employeeId?: string): Promise<Unavailability[]> {
  let query = supabase.from('unavailabilities').select('*')
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('day_of_week')
  if (error) throw error
  return (data ?? []).map(mapUnavailability)
}

export async function createUnavailability(u: Omit<Unavailability, 'id'>): Promise<Unavailability> {
  const { data, error } = await supabase
    .from('unavailabilities')
    .insert({
      employee_id: u.employeeId,
      type: u.type,
      day_of_week: u.dayOfWeek,
      specific_date: u.specificDate,
      label: u.label,
    })
    .select()
    .single()
  if (error) throw error
  return mapUnavailability(data)
}

export async function deleteUnavailability(id: string): Promise<void> {
  const { error } = await supabase.from('unavailabilities').delete().eq('id', id)
  if (error) throw error
}

// --- Manager Fixed Schedules ---

export async function fetchManagerSchedules(employeeId?: string): Promise<ManagerFixedSchedule[]> {
  let query = supabase.from('manager_fixed_schedules').select('*')
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('day_of_week')
  if (error) throw error
  return (data ?? []).map(mapManagerSchedule)
}

export async function upsertManagerSchedule(s: Omit<ManagerFixedSchedule, 'id'>): Promise<ManagerFixedSchedule> {
  const { data, error } = await supabase
    .from('manager_fixed_schedules')
    .upsert(
      {
        employee_id: s.employeeId,
        day_of_week: s.dayOfWeek,
        shift_template_id: s.shiftTemplateId,
        start_time: s.startTime,
        end_time: s.endTime,
      },
      { onConflict: 'employee_id,day_of_week' },
    )
    .select()
    .single()
  if (error) throw error
  return mapManagerSchedule(data)
}

// --- Conditional Availabilities ---

export async function fetchConditionalAvailabilities(employeeId?: string): Promise<ConditionalAvailability[]> {
  let query = supabase.from('conditional_availabilities').select('*')
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('day_of_week')
  if (error) throw error
  return (data ?? []).map(mapConditionalAvailability)
}

export async function createConditionalAvailability(ca: Omit<ConditionalAvailability, 'id'>): Promise<ConditionalAvailability> {
  const { data, error } = await supabase
    .from('conditional_availabilities')
    .insert({
      employee_id: ca.employeeId,
      day_of_week: ca.dayOfWeek,
      allowed_shift_codes: ca.allowedShiftCodes,
      max_hours: ca.maxHours,
    })
    .select()
    .single()
  if (error) throw error
  return mapConditionalAvailability(data)
}

export async function deleteConditionalAvailability(id: string): Promise<void> {
  const { error } = await supabase.from('conditional_availabilities').delete().eq('id', id)
  if (error) throw error
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
