import { describe, it, expect } from 'vitest'
import { normalisePhone } from '@/lib/phone-helpers'

describe('normalisePhone', () => {
  it('returns a plain number unchanged', () => {
    expect(normalisePhone('5511999999999')).toBe('5511999999999')
  })

  it('strips leading + from E.164 format', () => {
    expect(normalisePhone('+5511999999999')).toBe('5511999999999')
  })

  it('strips @c.us suffix (Z-API format)', () => {
    expect(normalisePhone('5511999999999@c.us')).toBe('5511999999999')
  })

  it('strips both + prefix and @c.us suffix', () => {
    expect(normalisePhone('+5511999999999@c.us')).toBe('5511999999999')
  })

  it('is case-insensitive for @c.us', () => {
    expect(normalisePhone('5511999999999@C.US')).toBe('5511999999999')
  })

  it('strips internal whitespace', () => {
    expect(normalisePhone('55 11 99999 9999')).toBe('5511999999999')
  })

  it('LAERTE_PHONE matches Z-API delivery format', () => {
    // This is the critical regression test: prior to the fix,
    // LAERTE_PHONE="+5511999999999" never matched "5511999999999" from Z-API
    const laerteEnvValue = '+5511999999999'
    const zapiDeliveryValue = '5511999999999'
    expect(normalisePhone(laerteEnvValue)).toBe(normalisePhone(zapiDeliveryValue))
  })

  it('handles empty string without throwing', () => {
    expect(normalisePhone('')).toBe('')
  })
})
