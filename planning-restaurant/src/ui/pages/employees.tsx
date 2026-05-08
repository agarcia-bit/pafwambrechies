import { useEffect, useState, useMemo } from 'react'
import { useEmployeeStore } from '@/store/employee-store'
import { useRoleStore } from '@/store/role-store'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/ui/components'
import { EmployeeForm } from '@/ui/components/employee-form'
import type { Employee } from '@/domain/models/employee'
import { Plus, Pencil, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

const CONTRACT_LABELS: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  extra: 'Extra',
  apprenti: 'Apprenti',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Niv. 1',
  2: 'Niv. 2',
  2.5: 'Niv. 2bis',
  3: 'Niv. 3',
  4: 'Manager',
}

export function EmployeesPage() {
  const { employees, loading, load, add, update, remove } = useEmployeeStore()
  const { roles, employeeRoles, load: loadRoles } = useRoleStore()
  const { tenantId } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>()
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [sortKey, setSortKey] = useState<string>('firstName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="ml-1" />
      : <ArrowDown size={12} className="ml-1" />
  }

  useEffect(() => {
    load()
    loadRoles()
  }, [load, loadRoles])

  const activeEmployees = employees.filter((e) => e.active)
  const inactiveEmployees = employees.filter((e) => !e.active)

  function getRoleForEmployee(employeeId: string) {
    const er = employeeRoles.find((er) => er.employeeId === employeeId)
    if (!er) return null
    return roles.find((r) => r.id === er.roleId) ?? null
  }

  const displayedEmployees = useMemo(() => {
    const list = [...(activeTab === 'active' ? activeEmployees : inactiveEmployees)]
    const dir = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      switch (sortKey) {
        case 'firstName': return dir * a.firstName.localeCompare(b.firstName)
        case 'contractType': return dir * a.contractType.localeCompare(b.contractType)
        case 'weeklyHours': return dir * (a.weeklyHours - b.weeklyHours)
        case 'level': return dir * (a.level - b.level)
        case 'role': {
          const ra = getRoleForEmployee(a.id)?.name ?? 'zzz'
          const rb = getRoleForEmployee(b.id)?.name ?? 'zzz'
          return dir * ra.localeCompare(rb)
        }
        case 'department': return dir * a.department.localeCompare(b.department)
        case 'createdAt': return dir * a.createdAt.localeCompare(b.createdAt)
        default: return 0
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization
  }, [employees, activeEmployees, inactiveEmployees, activeTab, sortKey, sortDir, roles, employeeRoles])

  function handleAdd(data: Omit<Employee, 'id' | 'createdAt'>) {
    add(data)
    setShowForm(false)
  }

  function handleEdit(data: Omit<Employee, 'id' | 'createdAt'>) {
    if (editingEmployee) {
      update(editingEmployee.id, data)
    }
    setEditingEmployee(undefined)
    setShowForm(false)
  }

  function handleToggleActive(emp: Employee) {
    update(emp.id, { active: !emp.active })
  }

  function handleDelete(emp: Employee) {
    if (confirm(`Supprimer définitivement ${emp.firstName} ${emp.lastName} ?`)) {
      remove(emp.id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salariés</h1>
        <Button onClick={() => { setEditingEmployee(undefined); setShowForm(true) }}>
          <Plus size={16} className="mr-2" /> Ajouter
        </Button>
      </div>

      {/* Onglets Actifs / Inactifs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Actifs ({activeEmployees.length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'inactive' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Inactifs ({inactiveEmployees.length})
        </button>
      </div>

      {loading && <p className="text-muted-foreground">Chargement...</p>}

      {/* Alerte salariés sans rôle */}
      {(() => {
        const withoutRole = activeEmployees.filter(
          (emp) => !employeeRoles.some((er) => er.employeeId === emp.id),
        )
        if (withoutRole.length === 0) return null
        return (
          <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/5 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium">
                {withoutRole.length} salarié{withoutRole.length > 1 ? 's' : ''} sans rôle attribué
              </p>
              <p className="text-sm text-muted-foreground">
                {withoutRole.map((e) => e.firstName).join(', ')} — Allez dans l'onglet <strong>Rôles</strong> pour leur affecter un poste.
              </p>
            </div>
          </div>
        )
      })()}

      {displayedEmployees.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {([
                  ['firstName', 'Nom', 'left'],
                  ['department', 'Département', 'left'],
                  ['contractType', 'Contrat', 'left'],
                  ['weeklyHours', 'Heures', 'left'],
                  ['level', 'Niveau', 'left'],
                  ['role', 'Rôle', 'left'],
                  ['createdAt', 'Ajouté le', 'left'],
                ] as [string, string, string][]).map(([key, label, align]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className={`px-4 py-3 text-${align} font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none`}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actif</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedEmployees.map((emp) => {
                const role = getRoleForEmployee(emp.id)
                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-border ${emp.active ? 'hover:bg-muted/30' : 'bg-muted/20 opacity-60'}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{emp.department}</td>
                    <td className="px-4 py-3">{CONTRACT_LABELS[emp.contractType] ?? emp.contractType}</td>
                    <td className="px-4 py-3">{emp.weeklyHours}h</td>
                    <td className="px-4 py-3">{LEVEL_LABELS[emp.level] ?? `Niv. ${emp.level}`}</td>
                    <td className="px-4 py-3">
                      {role ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: role.color }}
                        >
                          {role.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                          <AlertTriangle size={12} /> Non attribué
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(emp.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(emp)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emp.active ? 'bg-success' : 'bg-border'}`}
                        title={emp.active ? 'Désactiver (ne sera pas inclus dans les plannings)' : 'Réactiver'}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${emp.active ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingEmployee(emp); setShowForm(true) }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && employees.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aucun salarié</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Ajoutez vos premiers salariés pour commencer à générer des plannings.
            </p>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          tenantId={tenantId ?? ''}
          onSubmit={editingEmployee ? handleEdit : handleAdd}
          onCancel={() => { setShowForm(false); setEditingEmployee(undefined) }}
        />
      )}
    </div>
  )
}
