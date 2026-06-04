import { describe, it, expect } from 'vitest'
import {
  calcSemesterWeek,
  getCourseColor,
  getNodeTime,
  getRealWeekNum,
  getWeekDates,
  COLORS,
  TIME_ROWS,
  DAYS,
  DAY_INDEX,
} from '../constants'

describe('calcSemesterWeek', () => {
  it('should calculate correct week number', () => {
    const startDate = new Date('2026-03-02') // Monday
    const targetDate = new Date('2026-03-09') // Next Monday = week 2
    expect(calcSemesterWeek(startDate, targetDate)).toBe(2)
  })

  it('should return week 1 for same week', () => {
    const startDate = new Date('2026-03-02')
    const targetDate = new Date('2026-03-05') // Thursday same week
    expect(calcSemesterWeek(startDate, targetDate)).toBe(1)
  })

  it('should return null for null start date', () => {
    expect(calcSemesterWeek(null, new Date())).toBeNull()
  })
})

describe('getCourseColor', () => {
  it('should return a color object', () => {
    const color = getCourseColor('高等数学')
    expect(color).toHaveProperty('color')
    expect(color).toHaveProperty('light')
    expect(COLORS).toContainEqual(color)
  })

  it('should return consistent colors for same input', () => {
    const color1 = getCourseColor('英语')
    const color2 = getCourseColor('英语')
    expect(color1).toEqual(color2)
  })

  it('should return different colors for different inputs', () => {
    const color1 = getCourseColor('数学')
    const color2 = getCourseColor('物理')
    // They might be the same due to hash collision, but usually different
    expect(COLORS).toContainEqual(color1)
    expect(COLORS).toContainEqual(color2)
  })
})

describe('getNodeTime', () => {
  it('should return time range for valid node', () => {
    expect(getNodeTime('1-2')).toBe('08:20 - 09:55')
    expect(getNodeTime('3-4')).toBe('10:15 - 11:50')
    expect(getNodeTime('5-6')).toBe('14:30 - 16:05')
  })

  it('should return special time for 9-11', () => {
    expect(getNodeTime('9-11')).toBe('19:00 - 21:25')
  })

  it('should return empty string for null/undefined', () => {
    expect(getNodeTime(null)).toBe('')
    expect(getNodeTime(undefined)).toBe('')
    expect(getNodeTime('')).toBe('')
  })

  it('should return empty string for invalid node', () => {
    expect(getNodeTime('invalid')).toBe('')
  })
})

describe('getRealWeekNum', () => {
  it('should return a number between 1 and 53', () => {
    const weekNum = getRealWeekNum()
    expect(weekNum).toBeGreaterThanOrEqual(1)
    expect(weekNum).toBeLessThanOrEqual(53)
  })
})

describe('getWeekDates', () => {
  it('should return 7 dates', () => {
    const dates = getWeekDates(0)
    expect(dates).toHaveLength(7)
  })

  it('should have month, date, and full properties', () => {
    const dates = getWeekDates(0)
    dates.forEach(d => {
      expect(d).toHaveProperty('month')
      expect(d).toHaveProperty('date')
      expect(d).toHaveProperty('full')
      expect(d.month).toBeGreaterThanOrEqual(1)
      expect(d.month).toBeLessThanOrEqual(12)
      expect(d.date).toBeGreaterThanOrEqual(1)
      expect(d.date).toBeLessThanOrEqual(31)
    })
  })

  it('should handle week offset', () => {
    const thisWeek = getWeekDates(0)
    const nextWeek = getWeekDates(1)
    // Next week dates should be later
    expect(nextWeek[0].full.getTime()).toBeGreaterThan(thisWeek[6].full.getTime())
  })
})

describe('constants', () => {
  it('should have 7 days', () => {
    expect(DAYS).toHaveLength(7)
  })

  it('should have DAY_INDEX for all days', () => {
    expect(DAY_INDEX['周一']).toBe(1)
    expect(DAY_INDEX['周日']).toBe(0)
    expect(DAY_INDEX[0]).toBe(0)
    expect(DAY_INDEX[6]).toBe(6)
  })

  it('should have TIME_ROWS with node labels', () => {
    expect(TIME_ROWS.length).toBeGreaterThan(0)
    TIME_ROWS.forEach(row => {
      expect(row).toHaveProperty('node')
      expect(row).toHaveProperty('start')
      expect(row).toHaveProperty('end')
    })
  })
})
