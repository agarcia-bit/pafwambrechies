import { useEffect, useState, useMemo, useCallback } from 'react'
import { useForecastStore } from '@/store/forecast-store'
import { useAuthStore } from '@/store/auth-store'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/ui/components'
import { Save } from 'lucide-react'

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
// On ne montre pas lundi (fermé) et on indexe 1-6
const WORKING_DAYS = [1, 2, 3, 4, 5, 6]

export function ForecastsPage() {
  const { forecasts, loading, load, save } = useForecastStore()
  const { tenantId } = useAuthStore()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1) // 1-12
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  // Compute values from store + local overrides
  const values = useMemo(() => {
    const v: Record<string, number> = {}
    for (const day of WORKING_DAYS) {
      const f = forecasts.find((fc) => fc.month === selectedMonth && fc.dayOfWeek === day)
      v[String(day)] = f?.forecastedRevenue ?? 0
    }
    if (dirty) {
      return { ...v, ...overrides }
    }
    return v
  }, [selectedMonth, forecasts, dirty, overrides])

  const handleMonthChange = useCallback((month: number) => {
    setSelectedMonth(month)
    setOverrides({})
    setDirty(false)
  }, [])

  function handleChange(day: number, val: string) {
    setOverrides({ ...overrides, [String(day)]: Number(val) || 0 })
    setDirty(true)
  }

  async function handleSave() {
    if (!tenantId) return
    const rows = WORKING_DAYS.map((day) => ({
      tenantId,
      month: selectedMonth,
      dayOfWeek: day,
      forecastedRevenue: values[String(day)] ?? 0,
    }))
    await save(rows)
    setDirty(false)
  }

  const weekTotal = WORKING_DAYS.reduce((s, d) => s + (values[String(d)] ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CA Prévisionnel (N-1)</h1>
        <Button onClick={handleSave} disabled={!dirty || loading}>
          <Save size={16} className="mr-2" /> Enregistrer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélection du mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => handleMonthChange(i + 1)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedMonth === i + 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            CA moyen par jour — {MONTH_NAMES[selectedMonth - 1]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Saisissez le CA moyen observé en N-1 pour chaque jour de la semaine.
            Le lundi est fermé et n'apparaît pas.
          </p>
          <div className="grid grid-cols-6 gap-4">
            {WORKING_DAYS.map((day) => (
              <div key={day} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                  {DAY_NAMES[day]}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={values[String(day)] ?? 0}
                    onChange={(e) => handleChange(day, e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm text-right"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Total semaine</span>
            <span className="text-lg font-bold">{weekTotal.toLocaleString('fr-FR')} €</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
