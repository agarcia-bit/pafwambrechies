import { supabase } from '../client'
import type { ShiftTemplate } from '@/domain/models/shift'

export async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapShiftTemplate)
}

export async function createShiftTemplate(
  template: Omit<ShiftTemplate, 'id'>,
): Promise<ShiftTemplate> {
  const { data, error } = await supabase
    .from('shift_templates')
    .insert({
      tenant_id: template.tenantId,
      code: template.code,
      label: template.label,
      category: template.category,
      start_time: template.startTime,
      end_time: template.endTime,
      effective_hours: template.effectiveHours,
      meals: template.meals,
      baskets: template.baskets,
      applicability: template.applicability,
      sort_order: template.sortOrder,
    })
    .select()
    .single()

  if (error) throw error
  return mapShiftTemplate(data)
}

export async function updateShiftTemplate(
  id: string,
  updates: Partial<Omit<ShiftTemplate, 'id' | 'tenantId'>>,
): Promise<ShiftTemplate> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.code !== undefined) dbUpdates.code = updates.code
  if (updates.label !== undefined) dbUpdates.label = updates.label
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime
  if (updates.effectiveHours !== undefined) dbUpdates.effective_hours = updates.effectiveHours
  if (updates.meals !== undefined) dbUpdates.meals = updates.meals
  if (updates.baskets !== undefined) dbUpdates.baskets = updates.baskets
  if (updates.applicability !== undefined) dbUpdates.applicability = updates.applicability
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

  const { data, error } = await supabase
    .from('shift_templates')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapShiftTemplate(data)
}

export async function deleteShiftTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('shift_templates').delete().eq('id', id)
  if (error) throw error
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShiftTemplate(row: any): ShiftTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    category: row.category,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    effectiveHours: Number(row.effective_hours),
    meals: row.meals,
    baskets: row.baskets,
    applicability: row.applicability,
    sortOrder: row.sort_order,
  }
}
