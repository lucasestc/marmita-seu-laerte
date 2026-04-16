// @vitest-environment node
/**
 * P0 tests for the Z-API webhook handler:
 *   P0-011  No token → 401
 *   P0-011  Wrong token → 401
 *   P0-011  Correct token → proceeds (200 or business logic response)
 *
 * Additional P1-adjacent coverage included here:
 *   P1-009  PAGO parsing variants (case, whitespace)
 *   P1-009  Message from non-Laerte phone → ignored (200)
 *   P1-009  Unknown display_id → 200 (not found, logged)
 *   P1-010  Idempotency: already-confirmado order → 200, no re-notification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
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

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/webhooks/zapi/route'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-webhook-secret-123'
const LAERTE_PHONE = '5511000000000'
const CUSTOMER_PHONE = '+5511999999999'

function makeWebhookRequest(
  body: Record<string, unknown>,
  token?: string,
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['x-webhook-token'] = token

  return new NextRequest('http://localhost:3000/api/webhooks/zapi', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

const pagoPayload = {
  phone: LAERTE_PHONE,
  body: 'PAGO 0042',
}

const pendingOrder = {
  id: 10,
  status: 'aguardando_pagamento',
  delivery_date: '2026-04-15',
  customer_id: 1,
}

const confirmedOrder = {
  id: 10,
  status: 'confirmado',
  delivery_date: '2026-04-15',
  customer_id: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.LAERTE_PHONE = `+${LAERTE_PHONE}`
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.WEBHOOK_SECRET
  delete process.env.LAERTE_PHONE
})

// ---------------------------------------------------------------------------
// P0-011: Webhook authentication
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/zapi — auth', () => {
  it('[P0-011] no token → 401 Unauthorized', async () => {
    const req = makeWebhookRequest(pagoPayload) // no token in URL

    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('[P0-011] wrong token → 401 Unauthorized', async () => {
    const req = makeWebhookRequest(pagoPayload, 'wrong-secret')

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('[P0-011] WEBHOOK_SECRET not configured → 401 (fails safe)', async () => {
    delete process.env.WEBHOOK_SECRET
    const req = makeWebhookRequest(pagoPayload, WEBHOOK_SECRET)

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('correct token → proceeds past auth gate (not 401)', async () => {
    // Minimal Supabase mock: order not found — just check we don't get 401
    const supabase = makeMockSupabase({
      ordersRow: { data: null, error: { code: 'PGRST116' } },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(pagoPayload, WEBHOOK_SECRET)
    const res = await POST(req)

    expect(res.status).not.toBe(401)
  })
})

// ---------------------------------------------------------------------------
// P1-009: PAGO command parsing
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/zapi — PAGO parsing', () => {
  it('[P1-009] PAGO 0042 from Laerte → order confirmed, customer notified', async () => {
    const supabase = makeMockSupabase({
      ordersRow: { data: pendingOrder, error: null },
      customersRow: { data: { phone: CUSTOMER_PHONE }, error: null },
      updateResult: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(pagoPayload, WEBHOOK_SECRET)
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith({ status: 'confirmado' })
    expect(sendMessage).toHaveBeenCalledOnce()
  })

  it('[P1-009] pago 0042 (lowercase) → treated same as PAGO (case-insensitive)', async () => {
    const supabase = makeMockSupabase({
      ordersRow: { data: pendingOrder, error: null },
      customersRow: { data: { phone: CUSTOMER_PHONE }, error: null },
      updateResult: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest({ ...pagoPayload, body: 'pago 0042' }, WEBHOOK_SECRET)
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith({ status: 'confirmado' })
  })

  it('[P1-009] message from non-Laerte phone → ignored, returns 200, no DB update', async () => {
    const supabase = makeMockSupabase()
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(
      { phone: '5511111111111', body: 'PAGO 0042' }, // random person
      WEBHOOK_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('[P1-009] non-PAGO message from Laerte → ignored, returns 200', async () => {
    const supabase = makeMockSupabase()
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(
      { phone: LAERTE_PHONE, body: 'Boa tarde!' },
      WEBHOOK_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('[P1-009] unknown display_id → returns 200 (no crash), no update', async () => {
    const supabase = makeMockSupabase({
      ordersRow: { data: null, error: { code: 'PGRST116' } }, // not found
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(
      { phone: LAERTE_PHONE, body: 'PAGO 9999' },
      WEBHOOK_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('[P1-010] already-confirmado order → 200, no re-update, no second notification', async () => {
    const supabase = makeMockSupabase({
      ordersRow: { data: confirmedOrder, error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeWebhookRequest(pagoPayload, WEBHOOK_SECRET)
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.update).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
