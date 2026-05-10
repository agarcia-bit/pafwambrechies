import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { cn } from '@/lib/utils'

function decimalToHHMM(d: number): string {
  const h = Math.floor(d)
  const m = Math.round((d - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseToDecimal(s: string): number | null {
  const cleaned = s.replace('h', ':').replace('H', ':').trim()
  const parts = cleaned.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ? parseInt(parts[1], 10) : 0
  if (isNaN(h) || isNaN(m) || h < 0 || h > 24 || m < 0 || m >= 60) return null
  return h + m / 60
}

interface TimeInputProps {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}

export function TimeInput({ label, value, onChange, className }: TimeInputProps) {
  const [display, setDisplay] = useState(decimalToHHMM(value))
  const [invalid, setInvalid] = useState(false)

  // Sync display when value changes externally
  const formatted = decimalToHHMM(value)
  if (!invalid && display !== formatted && document.activeElement?.getAttribute('data-time-input') !== 'true') {
    // Only sync if not currently editing
    setDisplay(formatted)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setDisplay(raw)
    const parsed = parseToDecimal(raw)
    if (parsed !== null) {
      setInvalid(false)
      onChange(parsed)
    } else {
      setInvalid(true)
    }
  }

  function handleBlur(_e: FocusEvent<HTMLInputElement>) {
    const parsed = parseToDecimal(display)
    if (parsed !== null) {
      setDisplay(decimalToHHMM(parsed))
      setInvalid(false)
      onChange(parsed)
    } else {
      // Reset to last valid value
      setDisplay(decimalToHHMM(value))
      setInvalid(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-600">{label}</label>
      )}
      <input
        data-time-input="true"
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="HH:MM"
        className={cn(
          'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
          'placeholder:text-slate-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary',
          'transition-all',
          invalid && 'border-red-300 focus-visible:ring-red-200',
          className,
        )}
      />
    </div>
  )
}
