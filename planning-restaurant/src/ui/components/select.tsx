import { type SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold text-slate-600">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all',
            error && 'border-red-300',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'
