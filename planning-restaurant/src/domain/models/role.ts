export interface Role {
  id: string
  tenantId: string
  name: string // ex: "Serveur", "Barman", "Chef", "Plongeur"
  color: string // hex color for display
  sortOrder: number
}

/** Association employé ↔ rôle (un employé peut avoir plusieurs rôles) */
export interface EmployeeRole {
  employeeId: string
  roleId: string
}

/**
 * Niveaux de polyvalence :
 * - Niv 4 (manager) → peut faire tous les rôles
 * - Niv 3 → peut faire rôles 1, 2, 2bis
 * - Niv 2.5 → peut faire rôles 1, 2
 * - Niv 2 → peut faire rôle 1
 * - Niv 1 → son rôle uniquement
 */
