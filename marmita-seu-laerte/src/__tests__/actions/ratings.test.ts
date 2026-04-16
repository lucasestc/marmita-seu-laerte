// @vitest-environment node
/**
 * P1 tests for ratings server actions:
 *   P1-017  submitRating happy path → inserts into ratings table
 *   P1-018  submitRating duplicate → Postgres 23505 → Portuguese error
 *
 * Additional coverage:
 *   - submitRating unauthenticated → error
 *   - submitRating invalid stars (0, 6) → Zod error
 *   - submitRating wrong order owner → error
 *   - requestDeletion happy path → returns success even if email fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeSequentialMockSupabase } from '../helpers/supabase-mock'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}))

vi.mock('@/lib/zapi', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}))

// `mockResendSend` name starts with "mock" — required for use inside vi.mock factory
const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null })

vi.mock('resend', () => ({
  // Class syntax guarantees constructability; field evaluated at instantiation time
  // so mockResendSend is available (module-level declarations run before test execution)
  Resend: class MockResend {
    emails = { send: mockResendSend }
  },
}))

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------

import { submitRating, requestDeletion } from '@/actions/ratings'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSession = { customerId: 1, phone: '+5511999999999' }

beforeEach(() => {
  vi.clearAllMocks()
  mockResendSend.mockResolvedValue({ data: { id: 'mock-id' }, error: null })
  vi.mocked(getSession).mockResolvedValue(mockSession)
  process.env.LAERTE_EMAIL = 'laerte@example.com'
  process.env.RESEND_API_KEY = 'test-key'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LAERTE_EMAIL
  delete process.env.RESEND_API_KEY
})

// ---------------------------------------------------------------------------
// submitRating
// ---------------------------------------------------------------------------

describe('submitRating', () => {
  it('[P1-017] happy path → inserts into ratings with correct payload', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 1 }, error: null },    // customers.single()
      { data: { id: 10 }, error: null },   // orders.single()
      { data: null, error: null },          // ratings.insert (direct await)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await submitRating(10, 5)

    expect(result).toEqual({ success: true })
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: 10, stars: 5 }),
    )
  })

  it('[P1-018] duplicate rating → Postgres 23505 → Portuguese duplicate error', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 1 }, error: null },
      { data: { id: 10 }, error: null },
      { data: null, error: { code: '23505', message: 'unique violation' } },
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await submitRating(10, 4)

    expect(result).toEqual({
      success: false,
      error: 'Você já avaliou este pedido.',
    })
  })

  it('unauthenticated → error without hitting DB', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const result = await submitRating(10, 5)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('stars = 0 → Zod error, no DB call', async () => {
    const result = await submitRating(10, 0)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('stars = 6 → Zod error, no DB call', async () => {
    const result = await submitRating(10, 6)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('order not found (wrong owner) → error, no insert', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 1 }, error: null },
      { data: null, error: { code: 'PGRST116' } }, // order not found
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await submitRating(99, 5)

    expect(result.success).toBe(false)
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('stars range boundary: 1 star is valid', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 1 }, error: null },
      { data: { id: 10 }, error: null },
      { data: null, error: null },
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await submitRating(10, 1)

    expect(result).toEqual({ success: true })
  })
})

// ---------------------------------------------------------------------------
// requestDeletion
// ---------------------------------------------------------------------------

describe('requestDeletion', () => {
  it('happy path → sends email, fires WhatsApp, returns success', async () => {
    // No DB calls in requestDeletion
    const result = await requestDeletion()

    expect(result).toEqual({ success: true })
    // Email was attempted via Resend
    expect(mockResendSend).toHaveBeenCalledOnce()
    // WhatsApp confirmation attempted
    expect(sendMessage).toHaveBeenCalledWith(
      mockSession.phone,
      expect.stringContaining('exclusão de dados'),
    )
  })

  it('Resend email failure → still returns success (non-blocking)', async () => {
    mockResendSend.mockRejectedValueOnce(new Error('Resend API error'))

    const result = await requestDeletion()

    // Must return success even when email fails (request is logged server-side)
    expect(result).toEqual({ success: true })
  })

  it('unauthenticated → returns error', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const result = await requestDeletion()

    expect(result.success).toBe(false)
  })
})
