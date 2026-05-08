import { freshQuery } from '../fresh-query'
import type { PlanningEntry } from '@/domain/models/planning'

export interface SavedPlanning {
  id: string
  tenantId: string
  weekStartDate: string
  weekNumber: number
  status: 'draft' | 'validated'
  generatedAt: string
  createdBy: string | null
  department: string
}

export async function fetchPlannings(): Promise<SavedPlanning[]> {
  const data = await freshQuery((c) =>
    c.from('plannings').select('*').order('week_start_date', { ascending: false }).limit(20),
  )
  return ((data as Record<string, unknown>[]) ?? []).map(mapPlanning)
}

export async function savePlanningWithEntries(
  planning: {
    id: string
    tenantId: string
    weekStartDate: string
    weekNumber: number
    status: string
    createdBy: string
    department?: string
  },
  entries: PlanningEntry[],
): Promise<SavedPlanning> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  // Récupère le JWT depuis localStorage
  let token = apiKey
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k)
        if (raw) {
          const parsed = JSON.parse(raw)
          token = parsed?.access_token ?? parsed?.currentSession?.access_token ?? apiKey
          break
        }
      }
    }
  } catch { /* fallback */ }

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  // Upsert planning
  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/plannings?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      id: planning.id,
      tenant_id: planning.tenantId,
      week_start_date: planning.weekStartDate,
      week_number: planning.weekNumber,
      status: planning.status,
      created_by: planning.createdBy || null,
      department: planning.department ?? 'salle',
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!upsertRes.ok) throw new Error(`Save planning: ${upsertRes.status}`)
  const [saved] = await upsertRes.json()

  // Delete old entries
  await fetch(
    `${supabaseUrl}/rest/v1/planning_entries?planning_id=eq.${planning.id}`,
    { method: 'DELETE', headers, signal: AbortSignal.timeout(10000) },
  )

  // Insert new entries
  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      id: e.id,
      planning_id: planning.id,
      employee_id: e.employeeId,
      role_id: e.roleId || null,
      date: e.date,
      day_of_week: e.dayOfWeek,
      shift_template_id: e.shiftTemplateId,
      start_time: e.startTime,
      end_time: e.endTime,
      effective_hours: e.effectiveHours,
      meals: e.meals,
      baskets: e.baskets,
    }))
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/planning_entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(15000),
    })
    if (!insertRes.ok) throw new Error(`Save entries: ${insertRes.status}`)
  }

  return mapPlanning(saved)
}

export async function fetchPlanningEntries(planningId: string): Promise<PlanningEntry[]> {
  const data = await freshQuery((c) =>
    c.from('planning_entries').select('*').eq('planning_id', planningId).order('day_of_week'),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((row: any) => ({
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
  await freshQuery((c) => c.from('plannings').update({ status }).eq('id', id).select())
}

export async function deletePlanning(id: string): Promise<void> {
  await freshQuery((c) => c.from('plannings').delete().eq('id', id).select())
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
    department: row.department ?? 'salle',
  }
}
