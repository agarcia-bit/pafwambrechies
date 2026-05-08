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
  // Plannings salle par semaine (clé = weekISO)
  salleReports: Record<string, PlanningReport>
  setSalleReport: (report: PlanningReport | null, weekISO: string) => void
  getSalleReport: (weekISO: string) => PlanningReport | null

  // Plannings cuisine par semaine
  kitchenEntriesMap: Record<string, KitchenEntry[]>
  setKitchenEntries: (entries: KitchenEntry[], weekISO: string) => void
  getKitchenEntries: (weekISO: string) => KitchenEntry[]

  clearAll: () => void
}

export const useCurrentPlanningStore = create<CurrentPlanningState>((set, get) => ({
  salleReports: {},
  setSalleReport: (report, weekISO) => set((s) => {
    const next = { ...s.salleReports }
    if (report) next[weekISO] = report
    else delete next[weekISO]
    return { salleReports: next }
  }),
  getSalleReport: (weekISO) => get().salleReports[weekISO] ?? null,

  kitchenEntriesMap: {},
  setKitchenEntries: (entries, weekISO) => set((s) => ({
    kitchenEntriesMap: { ...s.kitchenEntriesMap, [weekISO]: entries },
  })),
  getKitchenEntries: (weekISO) => get().kitchenEntriesMap[weekISO] ?? [],

  clearAll: () => set({ salleReports: {}, kitchenEntriesMap: {} }),
}))
