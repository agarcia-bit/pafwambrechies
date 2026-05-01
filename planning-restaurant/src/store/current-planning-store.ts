import { create } from 'zustand'
import type { PlanningReport } from '@/domain/models/planning'

interface KitchenEntry {
  employeeId: string
  dayOfWeek: number
  shiftTemplateId: string
  startTime: number
  endTime: number
  effectiveHours: number
  period: 'midi' | 'soir'
}

interface CurrentPlanningState {
  // Planning salle généré (non sauvegardé)
  salleReport: PlanningReport | null
  salleWeekISO: string | null
  setSalleReport: (report: PlanningReport | null, weekISO: string) => void

  // Planning cuisine généré (non sauvegardé)
  kitchenEntries: KitchenEntry[]
  kitchenWeekISO: string | null
  setKitchenEntries: (entries: KitchenEntry[], weekISO: string) => void

  clearAll: () => void
}

/**
 * Store transient: garde en mémoire le dernier planning généré non sauvegardé,
 * pour qu'il reste affiché si l'utilisateur navigue ailleurs et revient.
 * Effacé à la déconnexion ou au refresh complet de la page.
 */
export const useCurrentPlanningStore = create<CurrentPlanningState>((set) => ({
  salleReport: null,
  salleWeekISO: null,
  setSalleReport: (report, weekISO) => set({ salleReport: report, salleWeekISO: weekISO }),

  kitchenEntries: [],
  kitchenWeekISO: null,
  setKitchenEntries: (entries, weekISO) => set({ kitchenEntries: entries, kitchenWeekISO: weekISO }),

  clearAll: () => set({
    salleReport: null,
    salleWeekISO: null,
    kitchenEntries: [],
    kitchenWeekISO: null,
  }),
}))
