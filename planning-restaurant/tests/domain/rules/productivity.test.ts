import { describe, it, expect } from 'vitest'
import {
  calculateHoursBudget,
  calculateAllocatableHours,
  checkProductivity,
  isDelestageRequired,
} from '@/domain/rules/productivity'

describe('Productivity Rules', () => {
  describe('calculateHoursBudget', () => {
    it('should calculate budget from CA and target', () => {
      // CA 1900€, target 95 → 1900/95 = 20h
      expect(calculateHoursBudget(1900, 95)).toBeCloseTo(20, 1)
    })

    it('should return 0 when target is 0', () => {
      expect(calculateHoursBudget(1000, 0)).toBe(0)
    })

    it('should handle large CA values', () => {
      // CA 5000€, target 95 → ~52.6h
      expect(calculateHoursBudget(5000, 95)).toBeCloseTo(52.63, 1)
    })
  })

  describe('calculateAllocatableHours', () => {
    it('should subtract manager hours from budget', () => {
      // CA 1900€, target 95 → 20h budget total. Managers = 12h → 8h à allouer
      expect(calculateAllocatableHours(1900, 95, 12)).toBeCloseTo(8, 1)
    })

    it('should not go below 0', () => {
      // Budget 10h mais managers = 15h → 0
      expect(calculateAllocatableHours(950, 95, 15)).toBe(0)
    })
  })

  describe('checkProductivity', () => {
    it('should return ok when productivity is 95 (target)', () => {
      // CA 1900€ / 20h = 95
      expect(checkProductivity(1900, 20, 80, 100)).toBe('ok')
    })

    it('should return ok at exactly 80 (min)', () => {
      // CA 1600€ / 20h = 80
      expect(checkProductivity(1600, 20, 80, 100)).toBe('ok')
    })

    it('should return ok at exactly 100 (max)', () => {
      // CA 2000€ / 20h = 100
      expect(checkProductivity(2000, 20, 80, 100)).toBe('ok')
    })

    it('should return over_staffed when productivity < 80', () => {
      // CA 1500€ / 20h = 75 → trop de staff
      expect(checkProductivity(1500, 20, 80, 100)).toBe('over_staffed')
    })

    it('should return under_staffed when productivity > 100', () => {
      // CA 2500€ / 20h = 125 → pas assez de staff
      expect(checkProductivity(2500, 20, 80, 100)).toBe('under_staffed')
    })

    it('should return under_staffed when 0 hours planned', () => {
      expect(checkProductivity(1000, 0, 80, 100)).toBe('under_staffed')
    })
  })

  describe('isDelestageRequired', () => {
    it('should return false when budget <= available', () => {
      expect(isDelestageRequired(100, 120)).toBe(false)
    })

    it('should return false when exactly equal', () => {
      expect(isDelestageRequired(100, 100)).toBe(false)
    })

    it('should return true when budget > available', () => {
      expect(isDelestageRequired(120, 100)).toBe(true)
    })
  })
})
