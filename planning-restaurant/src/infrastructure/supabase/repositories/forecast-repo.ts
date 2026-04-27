import { supabase } from '../client'
import type { DailyForecast } from '@/domain/models/planning'

export async function fetchDailyForecasts(): Promise<DailyForecast[]> {
  const { data, error } = await supabase
    .from('daily_forecasts')
    .select('*')
    .order('month')
    .order('day_of_week')
  if (error) throw error
  return (data ?? []).map(mapForecast)
}

export async function upsertDailyForecast(f: Omit<DailyForecast, 'id'>): Promise<DailyForecast> {
  const { data, error } = await supabase
    .from('daily_forecasts')
    .upsert(
      {
        tenant_id: f.tenantId,
        month: f.month,
        day_of_week: f.dayOfWeek,
        forecasted_revenue: f.forecastedRevenue,
      },
      { onConflict: 'tenant_id,month,day_of_week' },
    )
    .select()
    .single()
  if (error) throw error
  return mapForecast(data)
}

export async function upsertDailyForecasts(forecasts: Omit<DailyForecast, 'id'>[]): Promise<void> {
  const rows = forecasts.map((f) => ({
    tenant_id: f.tenantId,
    month: f.month,
    day_of_week: f.dayOfWeek,
    forecasted_revenue: f.forecastedRevenue,
  }))
  const { error } = await supabase
    .from('daily_forecasts')
    .upsert(rows, { onConflict: 'tenant_id,month,day_of_week' })
  if (error) throw error
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
