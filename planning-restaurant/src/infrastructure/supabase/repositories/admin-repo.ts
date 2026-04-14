import { supabase } from '../client'
import type { Tenant } from '@/domain/models/tenant'
import { mergeRules } from '@/domain/models/tenant'

export interface AdminUser {
  id: string
  email: string
  fullName: string
  role: string
  tenantId: string | null
  tenantName: string | null
}

/** Appel l'edge function admin-users avec le JWT de l'utilisateur courant. */
async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  // Récupère le token de session et le passe explicitement (sinon le header
  // Authorization peut contenir la clé anon au lieu du JWT user).
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Non authentifié')

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) {
    // L'erreur Supabase ne contient pas le body JSON, essaie de le récupérer
    const msg = (data && typeof data === 'object' && 'error' in data)
      ? (data as { error: string }).error
      : error.message
    throw new Error(msg)
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as Record<string, unknown>
}

// ---------- Users ----------
export async function fetchAllUsers(): Promise<AdminUser[]> {
  const data = await callAdmin('list_users')
  const users = (data.users as Record<string, unknown>[]) ?? []
  return users.map((u) => ({
    id: u.id as string,
    email: u.email as string,
    fullName: (u.full_name as string) ?? '',
    role: (u.role as string) ?? 'manager',
    tenantId: (u.tenant_id as string) ?? null,
    tenantName: (u.tenants as { name: string } | null)?.name ?? null,
  }))
}

export async function createUser(params: {
  email: string
  password: string
  fullName: string
  tenantId: string
  role?: string
}) {
  return callAdmin('create_user', {
    email: params.email,
    password: params.password,
    full_name: params.fullName,
    tenant_id: params.tenantId,
    role: params.role ?? 'manager',
  })
}

export async function updateUser(params: {
  userId: string
  tenantId?: string
  role?: string
  fullName?: string
}) {
  return callAdmin('update_user', {
    user_id: params.userId,
    tenant_id: params.tenantId,
    role: params.role,
    full_name: params.fullName,
  })
}

export async function deleteUser(userId: string) {
  return callAdmin('delete_user', { user_id: userId })
}

// ---------- Tenants (via RLS super_admin) ----------
export async function fetchAllTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('name')
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
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
  }))
}

export async function createTenant(params: {
  name: string
  address?: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name: params.name, address: params.address ?? null })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function deleteTenant(tenantId: string) {
  const { error } = await supabase.from('tenants').delete().eq('id', tenantId)
  if (error) throw error
}

// Nombre d'utilisateurs par tenant (calculé côté client)
export function countUsersPerTenant(users: AdminUser[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const u of users) {
    if (u.tenantId) counts[u.tenantId] = (counts[u.tenantId] ?? 0) + 1
  }
  return counts
}
