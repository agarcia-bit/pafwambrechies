import ExcelJS from 'exceljs'
import type { PlanningReport } from '@/domain/models/planning'

const ORANGE = 'FFC000'
const YELLOW = 'FFFF00'
const HEADER_BG = '1E3A5F'
const HEADER_FG = 'FFFFFF'

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/**
 * Génère un fichier Excel du planning au format attendu.
 * Télécharge automatiquement le fichier.
 */
export async function exportPlanningToExcel(
  report: PlanningReport,
  // Seuils repris des réglages du tenant. Ils étaient codés en dur à 80/100
  // ici alors que l'interface utilise 85/110 : le même jour pouvait être vert
  // à l'écran et rouge dans le fichier exporté.
  productivityLowerThreshold = 85,
  productivityUpperThreshold = 110,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Planning')

  // --- En-tête ---
  ws.getCell('C1').value = 'PLANNING SALLE'
  ws.getCell('C1').font = { bold: true, size: 14 }

  ws.getCell('C3').value = `Semaine ${report.planning.weekNumber}`
  ws.getCell('C3').font = { bold: true, size: 12 }

  // --- Ligne 4 : en-têtes colonnes ---
  const headerRow = 4
  // ExcelJS ignore l'index 0 de row.values : l'index i tombe donc en colonne
  // i+1. Les libellés de jour doivent commencer à l'index 2 pour atterrir en
  // colonne C, là où le corps du tableau écrit les données du jour 0
  // (getCell(3)). Il y avait un '' de trop : chaque jour était titré au-dessus
  // de la colonne du jour suivant.
  const hRow = ws.getRow(headerRow)
  hRow.values = ['', '', ...DAY_NAMES.flatMap((d) => [d, '', '']), 'Total', 'Contrat', '', 'Nb Repas', '', 'Nb Paniers']
  hRow.font = { bold: true, size: 9, color: { argb: HEADER_FG } }
  hRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })

  // Sub-headers (Début/Fin/Heures)
  const subRow = ws.getRow(headerRow + 1)
  const subVals: string[] = ['Contrat', 'Salarié']
  for (let d = 0; d < 7; d++) {
    subVals.push('Début', 'Fin', 'Heures')
  }
  subVals.push('Total', 'Contrat', '', 'Repas', '', 'Paniers')
  subRow.values = subVals
  subRow.font = { bold: true, size: 8 }
  subRow.eachCell((cell) => {
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder()
  })

  // --- Ligne 5 : dates ---
  const dateRow = ws.getRow(5)
  for (let d = 0; d < 7; d++) {
    const entry = report.dailySummaries.find((s) => s.dayOfWeek === d)
    if (entry) {
      const dateCell = dateRow.getCell(3 + d * 3)
      dateCell.value = formatDate(entry.date)
      dateCell.font = { italic: true, size: 8 }
    }
  }

  // --- Données salariés ---
  let row = 8
  const sortedSummaries = [...report.employeeSummaries].sort((a, b) => {
    // Managers first, then by contract hours desc
    const aEntry = report.planning.entries.find((e) => e.employeeId === a.employeeId)
    const bEntry = report.planning.entries.find((e) => e.employeeId === b.employeeId)
    return (bEntry ? 1 : 0) - (aEntry ? 1 : 0) || b.contractHours - a.contractHours
  })

  for (const summary of sortedSummaries) {
    const r = ws.getRow(row)

    // Colonne A (1) = Contrat heures
    r.getCell(1).value = summary.contractHours
    r.getCell(1).alignment = { horizontal: 'center' }

    // Colonne B (2) = Nom
    r.getCell(2).value = summary.employeeName
    r.getCell(2).font = { bold: true }

    // Pour chaque jour (0-6)
    for (let d = 0; d <= 6; d++) {
      const baseCol = 3 + d * 3 // Début
      const cellDebut = r.getCell(baseCol)
      const cellFin = r.getCell(baseCol + 1)
      const cellHeures = r.getCell(baseCol + 2)

      const entry = report.planning.entries.find(
        (e) => e.employeeId === summary.employeeId && e.dayOfWeek === d,
      )

      if (entry) {
        // Travaillé : orange
        cellDebut.value = entry.startTime
        cellDebut.numFmt = '0.0'
        cellFin.value = entry.endTime
        cellFin.numFmt = '0.0'
        cellHeures.value = { formula: `${cellFin.address}-${cellDebut.address}` }
        cellHeures.numFmt = '0.0'

        setFill(cellDebut, ORANGE)
        setFill(cellFin, ORANGE)
        setFill(cellHeures, ORANGE)
      } else {
        // OFF : jaune
        setFill(cellDebut, YELLOW)
        setFill(cellFin, YELLOW)
        setFill(cellHeures, YELLOW)
      }

      cellDebut.alignment = { horizontal: 'center' }
      cellFin.alignment = { horizontal: 'center' }
      cellHeures.alignment = { horizontal: 'center' }
      cellDebut.border = thinBorder()
      cellFin.border = thinBorder()
      cellHeures.border = thinBorder()
    }

    // Total (col 24)
    const totalCol = 3 + 7 * 3
    const heureCols = Array.from({ length: 7 }, (_, d) => r.getCell(3 + d * 3 + 2).address)
    r.getCell(totalCol).value = { formula: heureCols.join('+') }
    r.getCell(totalCol).numFmt = '0.0'
    r.getCell(totalCol).font = { bold: true }
    r.getCell(totalCol).alignment = { horizontal: 'center' }
    r.getCell(totalCol).border = thinBorder()

    // Contrat rappel (col 25)
    r.getCell(totalCol + 1).value = summary.contractHours
    r.getCell(totalCol + 1).alignment = { horizontal: 'center' }
    r.getCell(totalCol + 1).border = thinBorder()

    // Repas (col 27)
    r.getCell(totalCol + 3).value = summary.totalMeals
    r.getCell(totalCol + 3).alignment = { horizontal: 'center' }
    setFill(r.getCell(totalCol + 3), ORANGE)
    r.getCell(totalCol + 3).border = thinBorder()

    // Paniers (col 29)
    r.getCell(totalCol + 5).value = summary.totalBaskets
    r.getCell(totalCol + 5).alignment = { horizontal: 'center' }
    setFill(r.getCell(totalCol + 5), ORANGE)
    r.getCell(totalCol + 5).border = thinBorder()

    row++
  }

  // --- Ligne totaux ---
  const totalsRow = ws.getRow(row + 1)
  totalsRow.getCell(2).value = 'TOTAUX'
  totalsRow.getCell(2).font = { bold: true }
  for (let d = 0; d <= 6; d++) {
    const col = 3 + d * 3 + 2 // colonne heures
    const firstDataRow = 8
    const lastDataRow = row - 1
    const firstCell = ws.getRow(firstDataRow).getCell(col).address
    const lastCell = ws.getRow(lastDataRow).getCell(col).address
    totalsRow.getCell(col).value = { formula: `SUM(${firstCell}:${lastCell})` }
    totalsRow.getCell(col).numFmt = '0.0'
    totalsRow.getCell(col).font = { bold: true }
    totalsRow.getCell(col).alignment = { horizontal: 'center' }
    totalsRow.getCell(col).border = thinBorder()
  }

  // --- Tableau présence ---
  const presenceStartRow = row + 3
  const presRow1 = ws.getRow(presenceStartRow)
  presRow1.getCell(2).value = 'PRÉSENCE'
  presRow1.getCell(2).font = { bold: true }

  const presLabels = ['Midi 12-15h', 'Après-midi 15-18h', 'Soir 18h→ferm.']
  for (let i = 0; i < presLabels.length; i++) {
    const pr = ws.getRow(presenceStartRow + 1 + i)
    pr.getCell(2).value = presLabels[i]
    pr.getCell(2).font = { size: 9 }
    for (const ds of report.dailySummaries) {
      const col = 3 + ds.dayOfWeek * 3
      pr.getCell(col).value =
        i === 0 ? ds.coverageMidi : i === 1 ? ds.coverageApresMidi : ds.coverageSoir
      pr.getCell(col).alignment = { horizontal: 'center' }
    }
  }

  // --- Productivité ---
  const prodRow = ws.getRow(presenceStartRow + 5)
  prodRow.getCell(2).value = 'Productivité'
  prodRow.getCell(2).font = { bold: true }
  for (const ds of report.dailySummaries) {
    const col = 3 + ds.dayOfWeek * 3
    prodRow.getCell(col).value = Math.round(ds.productivity)
    prodRow.getCell(col).alignment = { horizontal: 'center' }
    prodRow.getCell(col).font = {
      bold: true,
      color: {
        argb: ds.productivity >= productivityLowerThreshold
           && ds.productivity <= productivityUpperThreshold ? '16A34A' : 'DC2626',
      },
    }
  }

  // --- Column widths ---
  ws.getColumn(1).width = 8
  ws.getColumn(2).width = 20
  for (let c = 3; c <= 30; c++) {
    ws.getColumn(c).width = 7
  }

  // --- Export ---
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planning_S${report.planning.weekNumber}_${report.planning.weekStartDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// --- Helpers ---

function setFill(cell: ExcelJS.Cell, color: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'D0D0D0' } }
  return { top: side, bottom: side, left: side, right: side }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Export cuisine
// ---------------------------------------------------------------------------

export interface KitchenExportEntry {
  employeeId: string
  dayOfWeek: number
  startTime: number
  endTime: number
  effectiveHours: number
  period: 'midi' | 'soir'
}

export interface KitchenExportEmployee {
  id: string
  firstName: string
  lastName: string
  contractHours: number
}

/**
 * Génère le planning cuisine au format Excel.
 *
 * La cuisine ne peut pas réutiliser la feuille de la salle : les services y
 * sont coupés (midi ET soir le même jour), alors que la mise en page salle
 * n'offre qu'un seul créneau par jour. Chaque jour occupe donc deux colonnes,
 * Midi et Soir.
 */
export async function exportKitchenPlanningToExcel(
  weekNumber: number,
  weekStartDate: string,
  employees: KitchenExportEmployee[],
  entries: KitchenExportEntry[],
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Cuisine S${weekNumber}`)

  ws.getCell('B1').value = 'PLANNING CUISINE'
  ws.getCell('B1').font = { bold: true, size: 14 }
  ws.getCell('B2').value = `Semaine ${weekNumber} — à partir du ${formatDate(weekStartDate)}`
  ws.getCell('B2').font = { bold: true, size: 11 }

  // Ligne 4 : jour (fusionné sur 2 colonnes) ; ligne 5 : Midi / Soir.
  // Colonne A = contrat, B = salarié, puis 2 colonnes par jour à partir de C.
  const firstDayCol = 3
  const dayHeader = ws.getRow(4)
  const subHeader = ws.getRow(5)
  dayHeader.getCell(1).value = 'Contrat'
  dayHeader.getCell(2).value = 'Salarié'

  for (let d = 0; d <= 6; d++) {
    const c = firstDayCol + d * 2
    dayHeader.getCell(c).value = DAY_NAMES[d]
    ws.mergeCells(4, c, 4, c + 1)
    subHeader.getCell(c).value = 'Midi'
    subHeader.getCell(c + 1).value = 'Soir'
  }
  const totalCol = firstDayCol + 7 * 2
  dayHeader.getCell(totalCol).value = 'Total'
  ws.mergeCells(4, totalCol, 5, totalCol)

  for (const row of [dayHeader, subHeader]) {
    row.font = { bold: true, size: 9, color: { argb: HEADER_FG } }
    row.eachCell((cell) => {
      setFill(cell, HEADER_BG)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
    })
  }

  // Corps
  let rowIdx = 6
  for (const emp of employees) {
    const r = ws.getRow(rowIdx)
    r.getCell(1).value = emp.contractHours
    r.getCell(1).alignment = { horizontal: 'center' }
    r.getCell(1).border = thinBorder()
    r.getCell(2).value = `${emp.firstName} ${emp.lastName}`.trim()
    r.getCell(2).border = thinBorder()

    for (let d = 0; d <= 6; d++) {
      const c = firstDayCol + d * 2
      for (const [offset, period] of [[0, 'midi'], [1, 'soir']] as const) {
        const cell = r.getCell(c + offset)
        const entry = entries.find(
          (e) => e.employeeId === emp.id && e.dayOfWeek === d && e.period === period,
        )
        if (entry) {
          cell.value = `${entry.startTime}→${entry.endTime}`
          setFill(cell, ORANGE)
        } else {
          setFill(cell, YELLOW)
        }
        cell.alignment = { horizontal: 'center' }
        cell.font = { size: 9 }
        cell.border = thinBorder()
      }
    }

    const total = entries
      .filter((e) => e.employeeId === emp.id)
      .reduce((s, e) => s + e.effectiveHours, 0)
    const totalCell = r.getCell(totalCol)
    totalCell.value = Math.round(total * 10) / 10
    totalCell.numFmt = '0.0'
    totalCell.font = { bold: true }
    totalCell.alignment = { horizontal: 'center' }
    totalCell.border = thinBorder()
    rowIdx++
  }

  // Ligne « personnes par jour » : des personnes distinctes, pas des services,
  // sinon une coupure midi + soir compterait deux fois.
  const countRow = ws.getRow(rowIdx + 1)
  countRow.getCell(2).value = 'Personnes présentes'
  countRow.getCell(2).font = { bold: true }
  for (let d = 0; d <= 6; d++) {
    const c = firstDayCol + d * 2
    const n = new Set(entries.filter((e) => e.dayOfWeek === d).map((e) => e.employeeId)).size
    countRow.getCell(c).value = n
    ws.mergeCells(countRow.number, c, countRow.number, c + 1)
    countRow.getCell(c).alignment = { horizontal: 'center' }
    countRow.getCell(c).font = { bold: true }
    countRow.getCell(c).border = thinBorder()
  }

  ws.getColumn(1).width = 8
  ws.getColumn(2).width = 22
  for (let c = firstDayCol; c <= totalCol; c++) ws.getColumn(c).width = 11

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planning_cuisine_S${weekNumber}_${weekStartDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
