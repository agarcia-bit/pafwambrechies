import { useState, type FormEvent } from 'react'
import { Button, Input, Select } from '@/ui/components'
import type { Employee, ContractType, EmployeeLevel } from '@/domain/models/employee'
import { X } from 'lucide-react'

interface EmployeeFormProps {
  employee?: Employee
  tenantId: string
  onSubmit: (data: Omit<Employee, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const CONTRACT_OPTIONS = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'extra', label: 'Extra' },
  { value: 'apprenti', label: 'Apprenti' },
]

const LEVEL_OPTIONS = [
  { value: '1', label: 'Niveau 1 — Son rôle uniquement' },
  { value: '2', label: 'Niveau 2 — Rôle 1' },
  { value: '2.5', label: 'Niveau 2bis — Rôles 1 et 2' },
  { value: '3', label: 'Niveau 3 — Rôles 1, 2 et 2bis' },
  { value: '4', label: 'Niveau 4 — Manager (tous rôles)' },
]

export function EmployeeForm({ employee, tenantId, onSubmit, onCancel }: EmployeeFormProps) {
  const [firstName, setFirstName] = useState(employee?.firstName ?? '')
  const [lastName, setLastName] = useState(employee?.lastName ?? '')
  const [contractType, setContractType] = useState<ContractType>(employee?.contractType ?? 'cdi')
  const [weeklyHours, setWeeklyHours] = useState(employee?.weeklyHours ?? 35)
  const [modulationRange, setModulationRange] = useState(employee?.modulationRange ?? 5)
  const [level, setLevel] = useState<EmployeeLevel>(employee?.level ?? 1)
  const [isManager, setIsManager] = useState(employee?.isManager ?? false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      tenantId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      contractType,
      weeklyHours,
      modulationRange,
      level,
      isManager,
      active: employee?.active ?? true,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {employee ? 'Modifier le salarié' : 'Ajouter un salarié'}
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="firstName"
              label="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              id="lastName"
              label="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="contractType"
              label="Type de contrat"
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
              options={CONTRACT_OPTIONS}
            />
            <Select
              id="level"
              label="Niveau"
              value={String(level)}
              onChange={(e) => {
                const val = Number(e.target.value) as EmployeeLevel
                setLevel(val)
                setIsManager(val === 4)
              }}
              options={LEVEL_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="weeklyHours"
              label="Heures / semaine (contrat)"
              type="number"
              min={0}
              max={48}
              step={0.5}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              required
            />
            <Input
              id="modulationRange"
              label="Modulation +/- (heures)"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={modulationRange}
              onChange={(e) => setModulationRange(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isManager"
              type="checkbox"
              checked={isManager}
              onChange={(e) => setIsManager(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="isManager" className="text-sm font-medium">
              Manager (horaires fixes, copié tel quel)
            </label>
          </div>

          <p className="text-sm text-muted-foreground">
            Bornes hebdo : {weeklyHours - modulationRange}h — {weeklyHours + modulationRange}h
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              {employee ? 'Enregistrer' : 'Ajouter'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
