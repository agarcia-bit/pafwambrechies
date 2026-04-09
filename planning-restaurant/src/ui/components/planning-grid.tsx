import type { PlanningReport } from '@/domain/models/planning'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface PlanningGridProps {
  report: PlanningReport
}

export function PlanningGrid({ report }: PlanningGridProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Grille principale */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="sticky left-0 z-10 bg-primary px-2 py-2 text-left">Contrat</th>
              <th className="sticky left-16 z-10 bg-primary px-2 py-2 text-left">Salarié</th>
              {DAY_NAMES.map((day, i) => (
                <th key={i} colSpan={3} className="px-1 py-2 text-center">
                  {day}
                  {report.dailySummaries.find((d) => d.dayOfWeek === i) && (
                    <div className="text-[10px] font-normal opacity-75">
                      {formatDateShort(report.dailySummaries.find((d) => d.dayOfWeek === i)?.date ?? '')}
                    </div>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-center">Total</th>
              <th className="px-2 py-2 text-center">Repas</th>
              <th className="px-2 py-2 text-center">Paniers</th>
            </tr>
            <tr className="bg-primary/80 text-primary-foreground text-[10px]">
              <th className="sticky left-0 z-10 bg-primary/80"></th>
              <th className="sticky left-16 z-10 bg-primary/80"></th>
              {DAY_NAMES.map((_, i) => (
                <th key={`sub-${i}`} colSpan={3} className="px-1 py-1 text-center">
                  <span className="inline-flex gap-2">
                    <span>Déb</span><span>Fin</span><span>H</span>
                  </span>
                </th>
              ))}
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {report.employeeSummaries.map((summary) => (
              <tr key={summary.employeeId} className="border-b border-border hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-center font-mono">
                  {summary.contractHours}
                </td>
                <td className="sticky left-16 z-10 bg-background px-2 py-1.5 font-medium whitespace-nowrap">
                  {summary.employeeName}
                </td>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const entry = report.planning.entries.find(
                    (e) => e.employeeId === summary.employeeId && e.dayOfWeek === d,
                  )
                  const isOff = !entry
                  const bgClass = isOff ? 'bg-planning-off/40' : 'bg-planning-work/40'
                  return (
                    <td key={d} colSpan={3} className={`px-1 py-1.5 text-center ${bgClass}`}>
                      {entry ? (
                        <span className="inline-flex gap-1">
                          <span>{entry.startTime}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{entry.endTime}</span>
                          <span className="font-bold">({entry.effectiveHours})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">OFF</span>
                      )}
                    </td>
                  )
                })}
                <td className={`px-2 py-1.5 text-center font-bold ${summary.status !== 'ok' ? 'text-destructive' : ''}`}>
                  {summary.plannedHours}h
                </td>
                <td className="px-2 py-1.5 text-center">{summary.totalMeals}</td>
                <td className="px-2 py-1.5 text-center">{summary.totalBaskets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tableau productivité */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-left font-medium">Jour</th>
              <th className="px-3 py-2 text-center font-medium">CA cible</th>
              <th className="px-3 py-2 text-center font-medium">Heures</th>
              <th className="px-3 py-2 text-center font-medium">Productivité</th>
              <th className="px-3 py-2 text-center font-medium">Midi</th>
              <th className="px-3 py-2 text-center font-medium">A-midi</th>
              <th className="px-3 py-2 text-center font-medium">Soir</th>
              <th className="px-3 py-2 text-center font-medium">Fermeture</th>
            </tr>
          </thead>
          <tbody>
            {report.dailySummaries.map((ds) => {
              const prodOk = ds.productivity >= 80 && ds.productivity <= 100
              return (
                <tr key={ds.dayOfWeek} className="border-b border-border">
                  <td className="px-3 py-2 font-medium">{DAY_NAMES[ds.dayOfWeek]}</td>
                  <td className="px-3 py-2 text-center">{ds.forecastedRevenue.toLocaleString('fr-FR')}€</td>
                  <td className="px-3 py-2 text-center">{ds.plannedHours}h</td>
                  <td className={`px-3 py-2 text-center font-bold ${prodOk ? 'text-success' : 'text-destructive'}`}>
                    {ds.productivity > 0 ? Math.round(ds.productivity) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">{ds.coverageMidi}</td>
                  <td className="px-3 py-2 text-center">{ds.coverageApresMidi}</td>
                  <td className="px-3 py-2 text-center">{ds.coverageSoir}</td>
                  <td className="px-3 py-2 text-center">{ds.closingStaff}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Violations */}
      {report.violations.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <h3 className="mb-2 font-bold text-destructive">
            Violations ({report.violations.length})
          </h3>
          <ul className="space-y-1">
            {report.violations.map((v, i) => (
              <li key={i} className="text-sm text-destructive">
                [{v.rule}] {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/50 bg-warning/5 p-4">
          <h3 className="mb-2 font-bold text-warning">
            Avertissements ({report.warnings.length})
          </h3>
          <ul className="space-y-1">
            {report.warnings.map((w, i) => (
              <li key={i} className="text-sm">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Statut */}
      <div className={`rounded-lg p-4 text-center font-bold ${report.isValid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
        {report.isValid ? 'PLANNING VALIDE' : 'PLANNING INVALIDE — Voir les violations ci-dessus'}
      </div>
    </div>
  )
}

function formatDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
