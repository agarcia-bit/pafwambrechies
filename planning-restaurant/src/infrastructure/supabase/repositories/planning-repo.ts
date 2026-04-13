import { supabase } from '../client'
import type { PlanningEntry } from '@/domain/models/planning'

export interface SavedPlanning {
  id: string
  tenantId: string
  weekStartDate: string
  weekNumber: number
  status: 'draft' | 'validated'
  generatedAt: string
  createdBy: string | null
}

export async function fetchPlannings(): Promise<SavedPlanning[]> {
  const { data, error } = await supabase
    .from('plannings')
    .select('*')
    .order('week_start_date', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(mapPlanning)
}

export async function savePlanningWithEntries(
  planning: {
    id: string
    tenantId: string
    weekStartDate: string
    weekNumber: number
    status: string
    createdBy: string
  },
  entries: PlanningEntry[],
): Promise<SavedPlanning> {
  // Upsert planning
  const { data, error } = await supabase
    .from('plannings')
    .upsert({
      id: planning.id,
      tenant_id: planning.tenantId,
      week_start_date: planning.weekStartDate,
      week_number: planning.weekNumber,
      status: planning.status,
      created_by: planning.createdBy,
    })
    .select()
    .single()
  if (error) throw error

  // Delete old entries for this planning
  await supabase.from('planning_entries').delete().eq('planning_id', planning.id)

  // Insert new entries
  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      id: e.id,
      planning_id: planning.id,
      employee_id: e.employeeId,
      role_id: e.roleId,
      date: e.date,
      day_of_week: e.dayOfWeek,
      shift_template_id: e.shiftTemplateId,
      start_time: e.startTime,
      end_time: e.endTime,
      effective_hours: e.effectiveHours,
      meals: e.meals,
      baskets: e.baskets,
    }))
    const { error: entryError } = await supabase.from('planning_entries').insert(rows)
    if (entryError) throw entryError
  }

  return mapPlanning(data)
}

export async function fetchPlanningEntries(planningId: string): Promise<PlanningEntry[]> {
  const { data, error } = await supabase
    .from('planning_entries')
    .select('*')
    .eq('planning_id', planningId)
    .order('day_of_week')
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    planningId: row.planning_id,
    employeeId: row.employee_id,
    roleId: row.role_id,
    date: row.date,
    dayOfWeek: row.day_of_week,
    shiftTemplateId: row.shift_template_id,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    effectiveHours: Number(row.effective_hours),
    meals: row.meals,
    baskets: row.baskets,
  }))
}

export async function updatePlanningStatus(id: string, status: 'draft' | 'validated'): Promise<void> {
  const { error } = await supabase
    .from('plannings')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function deletePlanning(id: string): Promise<void> {
  const { error } = await supabase.from('plannings').delete().eq('id', id)
  if (error) throw error
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlanning(row: any): SavedPlanning {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    weekStartDate: row.week_start_date,
    weekNumber: row.week_number,
    status: row.status,
    generatedAt: row.generated_at,
    createdBy: row.created_by,
  }
}
