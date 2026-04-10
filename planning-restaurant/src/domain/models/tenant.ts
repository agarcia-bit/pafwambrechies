export interface Tenant {
  id: string
  name: string
  address: string | null
  openingTime: number // decimal, e.g. 9.5 = 9h30
  closingTimeWeek: number // e.g. 24.0 = minuit
  closingTimeSunday: number // e.g. 21.0
  closedDays: readonly number[] // 0=lundi, 1=mardi... (default: [0] = lundi)
  productivityMin: number // default 80
  productivityMax: number // default 100
  productivityTarget: number // default 95
  createdAt: string
}

export const DEFAULT_TENANT_CONFIG = {
  openingTime: 9.5,
  closingTimeWeek: 24.0,
  closingTimeSunday: 21.0,
  closedDays: [0], // Lundi
  productivityMin: 80,
  productivityMax: 150,
  productivityTarget: 95,
} as const
