import { useEffect, useState } from 'react'
import { useRoleStore } from '@/store/role-store'
import { useEmployeeStore } from '@/store/employee-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

export function RolesPage() {
  const { roles, employeeRoles, loading, load, add, remove, assignRoles } = useRoleStore()
  const { employees, load: loadEmployees } = useEmployeeStore()
  const { tenantId } = useAuthStore()

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColor, setNewRoleColor] = useState('#3b82f6')

  useEffect(() => {
    load()
    loadEmployees()
  }, [load, loadEmployees])

  const activeEmployees = employees.filter((e) => e.active)

  function handleAddRole() {
    if (!newRoleName.trim() || !tenantId) return
    add({ tenantId, name: newRoleName.trim(), color: newRoleColor, sortOrder: roles.length })
    setNewRoleName('')
  }

  function handleAssignRole(employeeId: string, roleId: string) {
    const current = employeeRoles.filter((er) => er.employeeId === employeeId).map((er) => er.roleId)
    if (current.includes(roleId)) {
      // Décocher = retirer le rôle
      assignRoles(employeeId, [])
    } else {
      // Sélectionner = remplacer (1 seul rôle)
      assignRoles(employeeId, [roleId])
    }
  }

  function getEmployeeRole(employeeId: string): string | null {
    const er = employeeRoles.find((er) => er.employeeId === employeeId)
    return er?.roleId ?? null
  }

  const unassigned = activeEmployees.filter((emp) => !getEmployeeRole(emp.id))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Rôles & Affectations</h1>

      {/* Ajouter un rôle */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un rôle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <Input
              id="roleName"
              label="Nom du rôle"
              placeholder="ex: Serveur, Barman, Chef..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Couleur</label>
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewRoleColor(c)}
                    className={`h-8 w-8 rounded-md border-2 ${newRoleColor === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim()}>
              <Plus size={16} className="mr-2" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des rôles */}
      {roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rôles ({roles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5"
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                  <span className="text-sm font-medium">{role.name}</span>
                  <button
                    onClick={() => { if (confirm(`Supprimer le rôle "${role.name}" ?`)) remove(role.id) }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerte salariés sans rôle */}
      {unassigned.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {unassigned.length} salarié{unassigned.length > 1 ? 's' : ''} sans rôle
            </p>
            <p className="text-sm text-muted-foreground">
              {unassigned.map((e) => e.firstName).join(', ')} — Cliquez sur un rôle ci-dessous pour l'attribuer.
            </p>
          </div>
        </div>
      )}

      {/* Matrice employé ↔ rôle (radio: 1 seul rôle par salarié) */}
      {roles.length > 0 && activeEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Affectation des rôles par salarié</CardTitle>
            <p className="text-sm text-muted-foreground">Un seul rôle par salarié. Cliquez pour attribuer ou changer.</p>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-muted-foreground">Chargement...</p>}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Salarié</th>
                    {roles.map((role) => (
                      <th key={role.id} className="px-4 py-2 text-center font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                          {role.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...activeEmployees].sort((a, b) => {
                    const roleA = getEmployeeRole(a.id)
                    const roleB = getEmployeeRole(b.id)
                    // Salariés sans rôle: en haut de la liste
                    if (!roleA && roleB) return -1
                    if (roleA && !roleB) return 1
                    const nameA = roles.find((r) => r.id === roleA)?.name ?? ''
                    const nameB = roles.find((r) => r.id === roleB)?.name ?? ''
                    if (nameA !== nameB) return nameA.localeCompare(nameB)
                    return a.firstName.localeCompare(b.firstName)
                  }).map((emp) => {
                    const currentRole = getEmployeeRole(emp.id)
                    const hasNoRole = !currentRole
                    return (
                      <tr
                        key={emp.id}
                        className={`border-b border-border ${hasNoRole ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}
                      >
                        <td className="px-4 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            {hasNoRole && <AlertTriangle size={14} className="text-destructive" />}
                            {emp.firstName} {emp.lastName}
                            {emp.isManager && <span className="text-xs text-primary">(Manager)</span>}
                          </div>
                        </td>
                        {roles.map((role) => {
                          const isSelected = currentRole === role.id
                          return (
                            <td key={role.id} className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleAssignRole(emp.id, role.id)}
                                className={`h-5 w-5 rounded-full border-2 transition-all ${
                                  isSelected
                                    ? 'border-current scale-110'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                                style={isSelected ? { backgroundColor: role.color, borderColor: role.color } : {}}
                                title={isSelected ? `Retirer ${role.name}` : `Attribuer ${role.name}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
