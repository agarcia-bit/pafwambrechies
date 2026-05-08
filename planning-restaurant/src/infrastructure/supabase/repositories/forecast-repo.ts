import { freshQuery } from '../fresh-query'
import type { DailyForecast } from '@/domain/models/planning'

export async function fetchDailyForecasts(): Promise<DailyForecast[]> {
  const data = await freshQuery((c) =>
    c.from('daily_forecasts').select('*').order('month').order('day_of_week'),
  )
  return ((data as Record<string, unknown>[]) ?? []).map(mapForecast)
}

export async function upsertDailyForecast(f: Omit<DailyForecast, 'id'>): Promise<DailyForecast> {
  const data = await freshQuery((c) =>
    c.from('daily_forecasts').upsert(
      {
        tenant_id: f.tenantId,
        month: f.month,
        day_of_week: f.dayOfWeek,
        forecasted_revenue: f.forecastedRevenue,
      },
      { onConflict: 'tenant_id,month,day_of_week' },
    ).select().single(),
  )
  return mapForecast(data as Record<string, unknown>)
}

export async function upsertDailyForecasts(forecasts: Omit<DailyForecast, 'id'>[]): Promise<void> {
  const rows = forecasts.map((f) => ({
    tenant_id: f.tenantId,
    month: f.month,
    day_of_week: f.dayOfWeek,
    forecasted_revenue: f.forecastedRevenue,
  }))
  await freshQuery((c) =>
    c.from('daily_forecasts').upsert(rows, { onConflict: 'tenant_id,month,day_of_week' }).select(),
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapForecast(row: any): DailyForecast {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    month: row.month,
    dayOfWeek: row.day_of_week,
    forecastedRevenue: Number(row.forecasted_revenue),
  }
}
