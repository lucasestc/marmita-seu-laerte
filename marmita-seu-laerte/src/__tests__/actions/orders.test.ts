// @vitest-environment node
/**
 * P0 tests for order server actions:
 *   P0-005  placeOrder happy path → RPC called, redirect fires
 *   P0-006  placeOrder capacity exceeded → Portuguese error
 *   P0-007  placeOrder today's date → cutoff error (no DB needed)
 *   P0-009  cancelOrder aguardando_pagamento → success, status set to cancelado
 *   P0-014  cancelOrder already confirmado → rejected with Portuguese error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeMockSupabase } from '../helpers/supabase-mock'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/zapi', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------

import { placeOrder, cancelOrder, renewPixExpiry } from '@/actions/orders'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSession = { customerId: 1, phone: '+5511999999999' }
const mockCustomer = { data: { id: 1, name: 'Ana' }, error: null }
const tomorrow = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
})()
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const yesterday = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
})()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue(mockSession)
  process.env.LAERTE_PHONE = '+5511000000000'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LAERTE_PHONE
})

// ---------------------------------------------------------------------------
// placeOrder
// ---------------------------------------------------------------------------

describe('placeOrder', () => {
  it('[P0-007] today delivery date → cutoff error returned, no DB call', async () => {
    const result = await placeOrder(1, today)

    expect(result).toEqual({
      success: false,
      error: 'As reservas para este dia estão encerradas.',
    })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('[P0-007] yesterday delivery date → cutoff error, no DB call', async () => {
    const result = await placeOrder(1, yesterday)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('encerradas')
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('unauthenticated → error without hitting DB', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const result = await placeOrder(1, tomorrow)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('invalid menuItemId (0) → Zod error, no DB', async () => {
    const result = await placeOrder(0, tomorrow)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('[P0-005] happy path → RPC place_order called, redirect to /checkout/[displayId]', async () => {
    const supabase = makeMockSupabase({
      customersRow: mockCustomer,
      placeOrderRpc: {
        data: { success: true, display_id: '0042' },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    await placeOrder(1, tomorrow)

    expect(supabase.rpc).toHaveBeenCalledWith('place_order', {
      p_customer_id: 1,
      p_menu_item_id: 1,
      p_delivery_date: tomorrow,
    })
    expect(redirect).toHaveBeenCalledWith('/checkout/0042')
  })

  it('[P0-006] RPC returns CAPACITY_EXCEEDED → Portuguese error', async () => {
    const supabase = makeMockSupabase({
      customersRow: mockCustomer,
      placeOrderRpc: {
        data: { success: false, error_code: 'CAPACITY_EXCEEDED' },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await placeOrder(1, tomorrow)

    expect(result).toEqual({
      success: false,
      error: 'Esgotado para este dia. Escolha outro dia.',
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('RPC DB error → generic internal error', async () => {
    const supabase = makeMockSupabase({
      customersRow: mockCustomer,
      placeOrderRpc: {
        data: null,
        error: { message: 'DB connection failed' },
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await placeOrder(1, tomorrow)

    expect(result.success).toBe(false)
    if (!result.success) {
      // Must never expose raw DB error to user
      expect(result.error).not.toContain('DB connection')
    }
    expect(redirect).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------------------

describe('cancelOrder', () => {
  it('[P0-014] confirmado order → rejected with Portuguese error', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: {
        data: { id: 10, status: 'confirmado', display_id: '0010' },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await cancelOrder(10)

    expect(result).toEqual({
      success: false,
      error: 'Pedidos já confirmados não podem ser cancelados.',
    })
    // No update should have been called
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('[P0-009] aguardando_pagamento order → status updated to cancelado, returns success', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: {
        data: { id: 10, status: 'aguardando_pagamento', display_id: '0010' },
        error: null,
      },
      updateResult: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await cancelOrder(10)

    expect(result).toEqual({ success: true })
    expect(supabase.update).toHaveBeenCalledWith({ status: 'cancelado' })
  })

  it('entregue order → rejected (cannot cancel delivered orders)', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: {
        data: { id: 10, status: 'entregue', display_id: '0010' },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await cancelOrder(10)

    expect(result.success).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('unauthenticated → error without hitting DB', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const result = await cancelOrder(10)

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('order not found (wrong owner or missing) → error', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: { data: null, error: { code: 'PGRST116' } }, // not found
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await cancelOrder(99)

    expect(result.success).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// renewPixExpiry
// ---------------------------------------------------------------------------

describe('renewPixExpiry', () => {
  it('confirmado order → rejected with Portuguese error', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: {
        data: { id: 10, status: 'confirmado' },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await renewPixExpiry(10)

    expect(result).toEqual({
      success: false,
      error: 'Este pedido não pode ser atualizado.',
    })
  })

  it('aguardando_pagamento → new expiry timestamp returned', async () => {
    const supabase = makeMockSupabase({
      customersRow: { data: { id: 1 }, error: null },
      ordersRow: {
        data: { id: 10, status: 'aguardando_pagamento' },
        error: null,
      },
      updateResult: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const before = Date.now()
    const result = await renewPixExpiry(10)
    const after = Date.now()

    expect(result.success).toBe(true)
    if (result.success) {
      const newExpiry = new Date(result.data!.newExpiresAt).getTime()
      // New expiry should be ~30 minutes from now
      expect(newExpiry).toBeGreaterThan(before + 29 * 60 * 1000)
      expect(newExpiry).toBeLessThan(after + 31 * 60 * 1000)
    }
  })
})
