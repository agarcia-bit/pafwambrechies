import { supabase } from '../client'
import type { Tenant, TenantRules } from '@/domain/models/tenant'
import { mergeRules } from '@/domain/models/tenant'

export async function fetchTenant(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  if (!data) return null
  return mapTenant(data)
}

export async function updateTenant(
  tenantId: string,
  patch: Partial<Omit<Tenant, 'id' | 'createdAt'>>,
): Promise<Tenant> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.address !== undefined) row.address = patch.address
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl
  if (patch.openingTime !== undefined) row.opening_time = patch.openingTime
  if (patch.closingTimeWeek !== undefined) row.closing_time_week = patch.closingTimeWeek
  if (patch.closingTimeSunday !== undefined) row.closing_time_sunday = patch.closingTimeSunday
  if (patch.closedDays !== undefined) row.closed_days = patch.closedDays
  if (patch.productivityMin !== undefined) row.productivity_min = patch.productivityMin
  if (patch.productivityMax !== undefined) row.productivity_max = patch.productivityMax
  if (patch.productivityTarget !== undefined) row.productivity_target = patch.productivityTarget
  if (patch.rules !== undefined) row.rules = patch.rules

  const { data, error } = await supabase
    .from('tenants')
    .update(row)
    .eq('id', tenantId)
    .select()
    .single()
  if (error) throw error
  return mapTenant(data)
}

export async function updateTenantRules(
  tenantId: string,
  rules: TenantRules,
): Promise<Tenant> {
  return updateTenant(tenantId, { rules })
}

/** Upload un logo dans le bucket tenant-logos et renvoie l'URL publique. */
export async function uploadTenantLogo(
  tenantId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${tenantId}/logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('tenant-logos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })
  if (error) throw error
  const { data } = supabase.storage.from('tenant-logos').getPublicUrl(path)
  return data.publicUrl
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTenant(row: any): Tenant {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    logoUrl: row.logo_url ?? null,
    openingTime: Number(row.opening_time),
    closingTimeWeek: Number(row.closing_time_week),
    closingTimeSunday: Number(row.closing_time_sunday),
    closedDays: row.closed_days ?? [0],
    productivityMin: Number(row.productivity_min),
    productivityMax: Number(row.productivity_max),
    productivityTarget: Number(row.productivity_target),
    rules: mergeRules(row.rules),
    createdAt: row.created_at,
  }
}
