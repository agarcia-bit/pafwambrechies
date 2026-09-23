import { freshQuery } from '../fresh-query'

export interface MonthlyActual {
  id: string
  tenantId: string
  year: number
  month: number
  actualRevenue: number | null
}

export async function fetchMonthlyActuals(year: number): Promise<MonthlyActual[]> {
  const data = await freshQuery((c) =>
    c.from('monthly_actuals').select('*').eq('year', year).order('month'),
  )
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    year: r.year as number,
    month: r.month as number,
    actualRevenue: r.actual_revenue != null ? Number(r.actual_revenue) : null,
  }))
}

export async function upsertMonthlyActual(
  tenantId: string,
  year: number,
  month: number,
  actualRevenue: number,
): Promise<void> {
  await freshQuery((c) =>
    c.from('monthly_actuals').upsert(
      { tenant_id: tenantId, year, month, actual_revenue: actualRevenue },
      { onConflict: 'tenant_id,year,month' },
    ).select(),
  )
}
