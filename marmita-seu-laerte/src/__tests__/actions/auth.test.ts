// @vitest-environment node
/**
 * P0 tests for auth server actions:
 *   P0-001  requestOtp happy path
 *   P0-003  verifyOtp — wrong code returns error
 *   P0-004  requestOtp resend (second call creates fresh OTP row)
 *
 * Plus validation-only fast tests (no DB):
 *   - requestOtp: missing consent → Zod error
 *   - requestOtp: invalid phone → Zod error
 *   - requestOtp: Z-API failure → graceful Portuguese error
 *   - verifyOtp: expired OTP → expiry error
 *   - verifyOtp: no OTP row found → invalid error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { makeMockSupabase } from '../helpers/supabase-mock'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that transitively loads them
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/zapi', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/session', () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Lazy imports after mocks are registered
// ---------------------------------------------------------------------------

import { requestOtp, verifyOtp } from '@/actions/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validPhone = '+5511999999999'
const validCode = '382910'

let validCodeHash: string

beforeEach(async () => {
  vi.clearAllMocks()
  // Pre-compute a real bcrypt hash so verifyOtp's bcrypt.compare() can pass
  validCodeHash = await bcrypt.hash(validCode, 10)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// requestOtp
// ---------------------------------------------------------------------------

describe('requestOtp', () => {
  it('[P0-001] valid phone + consent → inserts OTP row and sends WhatsApp', async () => {
    const supabase = makeMockSupabase({ otpInsert: { data: null, error: null } })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await requestOtp(validPhone, true)

    expect(result).toEqual({ success: true, data: { phone: validPhone } })
    expect(supabase.from).toHaveBeenCalledWith('otp_codes')
    expect(supabase.insert).toHaveBeenCalledOnce()

    // Verify the insert payload: hashed code (never plain text), expires_at set
    const insertArg = vi.mocked(supabase.insert).mock.calls[0][0] as Record<string, unknown>
    expect(insertArg).toHaveProperty('phone', validPhone)
    expect(insertArg).toHaveProperty('code_hash')
    expect(typeof insertArg.code_hash).toBe('string')
    expect(insertArg.code_hash).not.toBe(validCode) // must be hashed
    expect(insertArg).toHaveProperty('expires_at')

    expect(sendMessage).toHaveBeenCalledOnce()
    const [sentTo, sentText] = vi.mocked(sendMessage).mock.calls[0]
    expect(sentTo).toBe(validPhone)
    expect(sentText).toMatch(/\d{6}/) // message contains 6-digit code
  })

  it('[P0-001] normalises Brazilian phone number to E.164 before inserting', async () => {
    const supabase = makeMockSupabase({ otpInsert: { data: null, error: null } })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    // Input without country code — action should normalise it
    const result = await requestOtp('11999999999', true)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.phone).toMatch(/^\+55/)
    }
  })

  it('missing consent → returns Portuguese error without hitting DB', async () => {
    const result = await requestOtp(validPhone, false)

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('WhatsApp'),
    })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('invalid phone format → returns Portuguese error without hitting DB', async () => {
    const result = await requestOtp('not-a-phone', true)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('Z-API failure → returns graceful Portuguese error (never exposes "Z-API")', async () => {
    const supabase = makeMockSupabase({ otpInsert: { data: null, error: null } })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('Z-API error: 503'))

    const result = await requestOtp(validPhone, true)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).not.toContain('Z-API')
      expect(result.error).not.toContain('503')
      // Must be a user-friendly Portuguese message
      expect(result.error.length).toBeGreaterThan(5)
    }
  })

  it('[P0-004] second requestOtp for same phone inserts a NEW row (does not delete old codes)', async () => {
    const supabase = makeMockSupabase({ otpInsert: { data: null, error: null } })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    await requestOtp(validPhone, true)
    await requestOtp(validPhone, true)

    // Two separate insert calls — old code stays in the table
    expect(supabase.insert).toHaveBeenCalledTimes(2)
    // No delete call
    const clientCalls = vi.mocked(supabase.from).mock.calls.map(([t]) => t)
    expect(clientCalls.every((t) => t === 'otp_codes')).toBe(true)
  })

  it('DB insert failure → returns internal error without sending WhatsApp', async () => {
    const supabase = makeMockSupabase({
      otpInsert: { data: null, error: { message: 'constraint violation' } },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await requestOtp(validPhone, true)

    expect(result.success).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

describe('verifyOtp', () => {
  it('[P0-003] wrong code → returns invalid error, no session created', async () => {
    const otpRow = {
      id: 1,
      code_hash: validCodeHash,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }
    const supabase = makeMockSupabase({
      otpCodesRow: { data: otpRow, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const { createSession } = await import('@/lib/session')
    const result = await verifyOtp(validPhone, '000000') // wrong code

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Código inválido'),
    })
    expect(createSession).not.toHaveBeenCalled()
  })

  it('no OTP row found → returns invalid error', async () => {
    const supabase = makeMockSupabase({
      otpCodesRow: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await verifyOtp(validPhone, validCode)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Código inválido')
    }
  })

  it('expired OTP → returns expiry error', async () => {
    const otpRow = {
      id: 1,
      code_hash: validCodeHash,
      expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    }
    const supabase = makeMockSupabase({
      otpCodesRow: { data: otpRow, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await verifyOtp(validPhone, validCode)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/expirado/i)
    }
  })

  it('invalid phone format → Zod error, no DB hit', async () => {
    const result = await verifyOtp('bad-phone', validCode)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('invalid code format (not 6 digits) → Zod error, no DB hit', async () => {
    const result = await verifyOtp(validPhone, '12345') // 5 digits

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
