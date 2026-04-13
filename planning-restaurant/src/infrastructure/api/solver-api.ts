/**
 * Client API for the CP-SAT planning solver backend.
 */

const SOLVER_URL = import.meta.env.VITE_SOLVER_URL ?? 'http://localhost:8000'

export interface SolverShiftAssignment {
  employee_id: string
  day_of_week: number
  shift_template_id: string
  start_time: number
  end_time: number
  effective_hours: number
  meals: number
  baskets: number
}

export interface SolverResponse {
  success: boolean
  entries: SolverShiftAssignment[]
  status: string
  solve_time_ms: number
  warnings: string[]
}

export async function callSolver(request: unknown): Promise<SolverResponse> {
  const res = await fetch(`${SOLVER_URL}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Solver error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function callKitchenSolver(request: unknown): Promise<SolverResponse> {
  const res = await fetch(`${SOLVER_URL}/solve-kitchen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Kitchen solver error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function checkSolverHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SOLVER_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
