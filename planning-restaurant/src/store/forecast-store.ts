import { create } from 'zustand'
import type { DailyForecast } from '@/domain/models/planning'
import {
  fetchDailyForecasts,
  upsertDailyForecasts,
} from '@/infrastructure/supabase/repositories/forecast-repo'

interface ForecastState {
  forecasts: DailyForecast[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  save: (forecasts: Omit<DailyForecast, 'id'>[]) => Promise<void>
  getForDay: (month: number, dayOfWeek: number) => number
}

export const useForecastStore = create<ForecastState>((set, get) => ({
  forecasts: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const forecasts = await fetchDailyForecasts()
      set({ forecasts, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  save: async (forecasts) => {
    set({ loading: true, error: null })
    try {
      await upsertDailyForecasts(forecasts)
      const updated = await fetchDailyForecasts()
      set({ forecasts: updated, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  getForDay: (month, dayOfWeek) => {
    const f = get().forecasts.find((f) => f.month === month && f.dayOfWeek === dayOfWeek)
    return f?.forecastedRevenue ?? 0
  },
}))
