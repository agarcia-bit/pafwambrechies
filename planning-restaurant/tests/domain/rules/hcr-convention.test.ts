import { describe, it, expect } from 'vitest'
import {
  checkRestBetweenShifts,
  checkMinDaysOff,
  checkWeeklyBounds,
  checkAbsoluteMaxWeekly,
  checkDailyMax,
  checkConsecutiveWorkDays,
} from '@/domain/rules/hcr-convention'

describe('HCR Convention Rules', () => {
  describe('checkRestBetweenShifts', () => {
    it('should pass when rest is >= 11h', () => {
      // Fin à 24h, début lendemain à 11h → 11h de repos
      expect(checkRestBetweenShifts(24.0, 11.0)).toBeNull()
    })

    it('should pass when rest is > 11h', () => {
      // Fin à 18h, début lendemain à 9.5h → 15.5h de repos
      expect(checkRestBetweenShifts(18.0, 9.5)).toBeNull()
    })

    it('should fail when rest is < 11h', () => {
      // Fin à 24h, début lendemain à 9.5h → 9.5h de repos
      expect(checkRestBetweenShifts(24.0, 9.5)).not.toBeNull()
    })

    it('should fail when rest is exactly 10h', () => {
      // Fin à 24h, début lendemain à 10h → 10h de repos
      expect(checkRestBetweenShifts(24.0, 10.0)).not.toBeNull()
    })
  })

  describe('checkMinDaysOff', () => {
    it('should pass with 2 days off (5 worked days + mon + 1 extra off)', () => {
      // 5 jours travaillés sur 7 = 2 jours off
      expect(checkMinDaysOff([1, 2, 3, 4, 5])).toBeNull()
    })

    it('should pass with 3 days off', () => {
      expect(checkMinDaysOff([1, 2, 3, 4])).toBeNull()
    })

    it('should fail with only 1 day off', () => {
      // 6 jours travaillés = 1 seul jour off
      expect(checkMinDaysOff([1, 2, 3, 4, 5, 6])).not.toBeNull()
    })

    it('should fail with 0 days off', () => {
      expect(checkMinDaysOff([0, 1, 2, 3, 4, 5, 6])).not.toBeNull()
    })
  })

  describe('checkWeeklyBounds', () => {
    it('should pass when hours are within bounds', () => {
      // CDI 35h, modulation +/-5h → 30-40h
      expect(checkWeeklyBounds(35, 30, 40)).toBeNull()
    })

    it('should pass at exact minimum', () => {
      expect(checkWeeklyBounds(30, 30, 40)).toBeNull()
    })

    it('should pass at exact maximum', () => {
      expect(checkWeeklyBounds(40, 30, 40)).toBeNull()
    })

    it('should fail when under minimum', () => {
      expect(checkWeeklyBounds(29, 30, 40)).not.toBeNull()
    })

    it('should fail when over maximum', () => {
      expect(checkWeeklyBounds(41, 30, 40)).not.toBeNull()
    })
  })

  describe('checkAbsoluteMaxWeekly', () => {
    it('should pass at 48h', () => {
      expect(checkAbsoluteMaxWeekly(48)).toBeNull()
    })

    it('should fail at 49h', () => {
      expect(checkAbsoluteMaxWeekly(49)).not.toBeNull()
    })
  })

  describe('checkDailyMax', () => {
    it('should pass at 10h', () => {
      expect(checkDailyMax(10)).toBeNull()
    })

    it('should fail at 11h', () => {
      expect(checkDailyMax(11)).not.toBeNull()
    })
  })

  describe('checkConsecutiveWorkDays', () => {
    it('should pass with 5 consecutive days', () => {
      // Lun off, Mar-Sam travaillé, Dim off
      expect(checkConsecutiveWorkDays([false, true, true, true, true, true, false])).toBeNull()
    })

    it('should pass with 6 consecutive days', () => {
      // Lun off, Mar-Dim travaillé
      expect(checkConsecutiveWorkDays([false, true, true, true, true, true, true])).toBeNull()
    })

    it('should fail with 7 consecutive days', () => {
      expect(checkConsecutiveWorkDays([true, true, true, true, true, true, true])).not.toBeNull()
    })

    it('should pass with alternating days', () => {
      expect(checkConsecutiveWorkDays([true, false, true, false, true, false, true])).toBeNull()
    })
  })
})
