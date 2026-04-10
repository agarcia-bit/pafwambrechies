import { supabase } from '../client'

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

export async function savePlanning(planning: {
  id: string
  tenantId: string
  weekStartDate: string
  weekNumber: number
  status: string
  createdBy: string
}): Promise<SavedPlanning> {
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
  return mapPlanning(data)
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
