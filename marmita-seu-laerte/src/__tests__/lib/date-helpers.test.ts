import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  nextMondayFrom,
  mondayOfWeek,
  formatDeliveryDateShort,
  tomorrowBrasilia,
  todayBrasilia,
} from '@/lib/date-helpers'

// ---------------------------------------------------------------------------
// nextMondayFrom
// ---------------------------------------------------------------------------

describe('nextMondayFrom', () => {
  it('Sunday (2026-04-12) → next day Monday (2026-04-13)', () => {
    expect(nextMondayFrom('2026-04-12')).toBe('2026-04-13')
  })

  it('Monday (2026-04-13) → following Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-13')).toBe('2026-04-20')
  })

  it('Tuesday (2026-04-14) → next Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-14')).toBe('2026-04-20')
  })

  it('Wednesday (2026-04-15) → next Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-15')).toBe('2026-04-20')
  })

  it('Thursday (2026-04-16) → next Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-16')).toBe('2026-04-20')
  })

  it('Friday (2026-04-17) → next Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-17')).toBe('2026-04-20')
  })

  it('Saturday (2026-04-18) → next Monday (2026-04-20)', () => {
    expect(nextMondayFrom('2026-04-18')).toBe('2026-04-20')
  })

  it('handles month rollover: Saturday 2026-01-31 → Monday 2026-02-02', () => {
    expect(nextMondayFrom('2026-01-31')).toBe('2026-02-02')
  })

  it('handles year rollover: Monday 2025-12-29 → Monday 2026-01-05', () => {
    expect(nextMondayFrom('2025-12-29')).toBe('2026-01-05')
  })
})

// ---------------------------------------------------------------------------
// mondayOfWeek
// ---------------------------------------------------------------------------

describe('mondayOfWeek', () => {
  it('Monday → same date', () => {
    expect(mondayOfWeek('2026-04-13')).toBe('2026-04-13')
  })

  it('Wednesday → Monday of same week', () => {
    expect(mondayOfWeek('2026-04-15')).toBe('2026-04-13')
  })

  it('Friday → Monday of same week', () => {
    expect(mondayOfWeek('2026-04-17')).toBe('2026-04-13')
  })

  it('Sunday → previous Monday (ISO week convention)', () => {
    // 2026-04-12 is a Sunday → Monday was 2026-04-06
    expect(mondayOfWeek('2026-04-12')).toBe('2026-04-06')
  })

  it('handles month rollover: Wednesday 2026-03-04 → Monday 2026-03-02', () => {
    expect(mondayOfWeek('2026-03-04')).toBe('2026-03-02')
  })
})

// ---------------------------------------------------------------------------
// formatDeliveryDateShort
// ---------------------------------------------------------------------------

describe('formatDeliveryDateShort', () => {
  it('formats a Thursday correctly', () => {
    // 2026-04-16 is a Thursday
    const result = formatDeliveryDateShort('2026-04-16')
    expect(result).toMatch(/^Quinta/)
    expect(result).toContain('16/04')
  })

  it('formats a Monday correctly', () => {
    // 2026-04-13 is a Monday
    const result = formatDeliveryDateShort('2026-04-13')
    expect(result).toMatch(/^Segunda/)
    expect(result).toContain('13/04')
  })

  it('formats a Friday correctly', () => {
    // 2026-04-17 is a Friday
    const result = formatDeliveryDateShort('2026-04-17')
    expect(result).toMatch(/^Sexta/)
    expect(result).toContain('17/04')
  })

  it('capitalises the weekday name', () => {
    const result = formatDeliveryDateShort('2026-04-13')
    expect(result[0]).toBe(result[0].toUpperCase())
  })

  it('uses comma separator between weekday and date', () => {
    const result = formatDeliveryDateShort('2026-04-13')
    expect(result).toContain(',')
  })
})

// ---------------------------------------------------------------------------
// tomorrowBrasilia / todayBrasilia
// ---------------------------------------------------------------------------

describe('tomorrowBrasilia', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns a valid YYYY-MM-DD string', () => {
    const result = tomorrowBrasilia()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a date one day ahead of todayBrasilia()', () => {
    const today = todayBrasilia()
    const tomorrow = tomorrowBrasilia()

    const [ty, tm, td] = today.split('-').map(Number)
    const [my, mm, md] = tomorrow.split('-').map(Number)

    const todayMs = new Date(ty, tm - 1, td).getTime()
    const tomorrowMs = new Date(my, mm - 1, md).getTime()

    expect(tomorrowMs - todayMs).toBe(24 * 60 * 60 * 1000)
  })
})

describe('todayBrasilia', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    expect(todayBrasilia()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
