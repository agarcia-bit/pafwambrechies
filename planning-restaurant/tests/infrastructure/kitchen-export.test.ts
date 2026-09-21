import { describe, it, expect, beforeEach, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  exportKitchenPlanningToExcel,
  type KitchenExportEntry,
  type KitchenExportEmployee,
} from '@/infrastructure/export/excel-export'

/**
 * L'export déclenche un téléchargement navigateur. On intercepte le Blob
 * produit pour relire réellement le classeur généré, plutôt que de se contenter
 * de vérifier que la fonction ne lève pas.
 */
// writeBuffer() renvoie un Buffer sous Node et un ArrayBuffer dans le
// navigateur : on accepte les deux.
let captured: ArrayBuffer | Uint8Array | null = null

beforeEach(() => {
  captured = null
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:stub')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('Blob', class {
    constructor(parts: unknown[]) {
      captured = parts[0] as ArrayBuffer | Uint8Array
    }
  })
})

const EMPLOYEES: KitchenExportEmployee[] = [
  { id: 'c1', firstName: 'Chaker', lastName: 'B.', contractHours: 39 },
  { id: 'c2', firstName: 'Ibra', lastName: 'K.', contractHours: 35 },
]

// Chaker fait une coupure le mardi (midi + soir), Ibra seulement le soir.
const ENTRIES: KitchenExportEntry[] = [
  { employeeId: 'c1', dayOfWeek: 1, startTime: 9, endTime: 15, effectiveHours: 5.5, period: 'midi' },
  { employeeId: 'c1', dayOfWeek: 1, startTime: 18, endTime: 23, effectiveHours: 5, period: 'soir' },
  { employeeId: 'c2', dayOfWeek: 1, startTime: 18, endTime: 23, effectiveHours: 5, period: 'soir' },
]

async function generate() {
  await exportKitchenPlanningToExcel(12, '2026-03-16', EMPLOYEES, ENTRIES)
  expect(captured, 'aucun classeur produit').not.toBeNull()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(captured!)
  return wb.worksheets[0]
}

describe('exportKitchenPlanningToExcel', () => {
  it('produit un classeur lisible', async () => {
    const ws = await generate()
    expect(ws.name).toBe('Cuisine S12')
    expect(ws.getCell('B1').value).toBe('PLANNING CUISINE')
  })

  it('aligne les sous-en-têtes Midi/Soir sur les colonnes de données', async () => {
    const ws = await generate()
    for (let d = 0; d <= 6; d++) {
      const col = 3 + d * 2
      expect(ws.getRow(5).getCell(col).value, `jour ${d} midi`).toBe('Midi')
      expect(ws.getRow(5).getCell(col + 1).value, `jour ${d} soir`).toBe('Soir')
    }
    expect(ws.getRow(4).getCell(3 + 7 * 2).value).toBe('Total')
  })

  it('place chaque service dans la bonne colonne', async () => {
    const ws = await generate()
    const mardiMidi = 3 + 1 * 2
    // Ligne 6 = premier salarié (Chaker)
    expect(ws.getRow(6).getCell(2).value).toBe('Chaker B.')
    expect(ws.getRow(6).getCell(mardiMidi).value).toBe('9→15')
    expect(ws.getRow(6).getCell(mardiMidi + 1).value).toBe('18→23')
    // Ibra n'a pas de service au midi
    expect(ws.getRow(7).getCell(2).value).toBe('Ibra K.')
    expect(ws.getRow(7).getCell(mardiMidi).value).toBeFalsy()
    expect(ws.getRow(7).getCell(mardiMidi + 1).value).toBe('18→23')
  })

  it('totalise les heures de la coupure sur une seule ligne', async () => {
    const ws = await generate()
    const totalCol = 3 + 7 * 2
    expect(ws.getRow(6).getCell(totalCol).value).toBe(10.5) // 5.5 + 5
    expect(ws.getRow(7).getCell(totalCol).value).toBe(5)
  })

  it('compte des personnes distinctes, pas des services', async () => {
    const ws = await generate()
    // 2 cuisiniers le mardi, dont un en coupure : le total doit être 2, pas 3.
    const countRow = ws.getRow(6 + EMPLOYEES.length + 1)
    expect(countRow.getCell(2).value).toBe('Personnes présentes')
    expect(countRow.getCell(3 + 1 * 2).value).toBe(2)
  })
})
