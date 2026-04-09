import { useEffect, useState } from 'react'
import { useRoleStore } from '@/store/role-store'
import { useEmployeeStore } from '@/store/employee-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { Plus, Trash2 } from 'lucide-react'

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

  function handleToggleRole(employeeId: string, roleId: string) {
    const current = employeeRoles.filter((er) => er.employeeId === employeeId).map((er) => er.roleId)
    const updated = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]
    assignRoles(employeeId, updated)
  }

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

      {/* Matrice employé ↔ rôle */}
      {roles.length > 0 && activeEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Affectation des rôles par salarié</CardTitle>
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
                  {activeEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {emp.firstName} {emp.lastName}
                        {emp.isManager && <span className="ml-2 text-xs text-primary">(Manager)</span>}
                      </td>
                      {roles.map((role) => {
                        const assigned = employeeRoles.some(
                          (er) => er.employeeId === emp.id && er.roleId === role.id,
                        )
                        return (
                          <td key={role.id} className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={() => handleToggleRole(emp.id, role.id)}
                              className="h-4 w-4 rounded border-border"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
