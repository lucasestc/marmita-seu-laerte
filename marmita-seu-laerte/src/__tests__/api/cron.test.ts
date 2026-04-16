// @vitest-environment node
/**
 * P1 tests for cron route handlers:
 *   P1-011  nightly-email: CRON_SECRET auth + Resend called + xlsx generated
 *   P1-012  morning-story: sends morning_message to each confirmed customer
 *   P1-013  rating-prompt: sequential sends, sets rating_prompt_sent_at
 *   P1-014  nightly-email fallback: Resend failure → sendMessage to Laerte
 *   P1-015  menu-reveal: no next-week menu → skips sends; with menu → sends all
 *
 * All crons share the same auth pattern (Bearer CRON_SECRET); the auth gate
 * is tested once for nightly-email and implicitly covered for the rest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeSequentialMockSupabase } from '../helpers/supabase-mock'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/zapi', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
}))

// `mockCronResendSend` name starts with "mock" — required for use inside vi.mock factory
const mockCronResendSend = vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null })

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockCronResendSend }
  },
}))

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------

import { GET as nightlyEmail } from '@/app/api/cron/nightly-email/route'
import { GET as morningStory } from '@/app/api/cron/morning-story/route'
import { GET as ratingPrompt } from '@/app/api/cron/rating-prompt/route'
import { GET as menuReveal } from '@/app/api/cron/menu-reveal/route'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-cron-secret'

function makeCronRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function makeUnauthedCronRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCronResendSend.mockResolvedValue({ data: { id: 'mock-id' }, error: null })
  process.env.CRON_SECRET = CRON_SECRET
  process.env.LAERTE_PHONE = '+5511000000000'
  process.env.LAERTE_EMAIL = 'laerte@example.com'
  process.env.RESEND_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_APP_URL = 'https://marmitadoseulaerte.com.br'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CRON_SECRET
  delete process.env.LAERTE_PHONE
  delete process.env.LAERTE_EMAIL
  delete process.env.RESEND_API_KEY
  delete process.env.NEXT_PUBLIC_APP_URL
})

// ---------------------------------------------------------------------------
// P1-011: nightly-email
// ---------------------------------------------------------------------------

describe('GET /api/cron/nightly-email', () => {
  it('[P1-011] no auth header → 401', async () => {
    const req = makeUnauthedCronRequest('/api/cron/nightly-email')
    const res = await nightlyEmail(req)
    expect(res.status).toBe(401)
  })

  it('[P1-011] with 2 confirmed orders → Resend.emails.send called once with xlsx attachment', async () => {
    const orders = [
      {
        display_id: '0001',
        status: 'confirmado',
        delivery_date: '2026-04-15',
        customers: { name: 'Ana', phone: '+5511999999999' },
        menu_items: { name: 'Frango Grelhado' },
      },
      {
        display_id: '0002',
        status: 'aguardando_pagamento',
        delivery_date: '2026-04-15',
        customers: { name: 'Rafael', phone: '+5511888888888' },
        menu_items: { name: 'Frango Grelhado' },
      },
    ]
    const supabase = makeSequentialMockSupabase(
      { data: orders, error: null }, // orders query (direct await)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/nightly-email')
    const res = await nightlyEmail(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orderCount).toBe(2)

    // Resend was called once
    expect(mockCronResendSend).toHaveBeenCalledOnce()

    // Email has an xlsx attachment
    const sendArgs = mockCronResendSend.mock.calls[0][0] as { attachments?: unknown[] }
    expect(sendArgs.attachments).toHaveLength(1)
    expect(sendArgs.attachments![0]).toMatchObject({
      filename: expect.stringMatching(/\.xlsx$/),
      content: expect.any(Buffer),
    })
  })

  it('[P1-011] no orders for tomorrow → Resend called with zero-order subject', async () => {
    const supabase = makeSequentialMockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/nightly-email')
    const res = await nightlyEmail(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orderCount).toBe(0)

    const sendArgs = mockCronResendSend.mock.calls[0][0] as { subject: string }
    expect(sendArgs.subject).toContain('nenhum pedido')
  })

  it('[P1-014] Resend failure → fallback WhatsApp to Laerte attempted', async () => {
    const supabase = makeSequentialMockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    mockCronResendSend.mockRejectedValueOnce(new Error('Resend 503'))

    const req = makeCronRequest('/api/cron/nightly-email')
    const res = await nightlyEmail(req)

    // Returns 500 but fallback WhatsApp was attempted
    expect(res.status).toBe(500)
    expect(sendMessage).toHaveBeenCalledWith(
      process.env.LAERTE_PHONE,
      expect.stringContaining('email'),
    )
  })
})

// ---------------------------------------------------------------------------
// P1-012: morning-story
// ---------------------------------------------------------------------------

describe('GET /api/cron/morning-story', () => {
  it('[P1-012] no auth header → 401', async () => {
    const req = makeUnauthedCronRequest('/api/cron/morning-story')
    const res = await morningStory(req)
    expect(res.status).toBe(401)
  })

  it('[P1-012] sends morning_message to each confirmed customer today', async () => {
    const menuItem = {
      name: 'Frango Capira',
      description: 'Com polenta cremosa',
      morning_message: 'Frango feito com carinho hoje 🍗',
    }
    const orders = [
      { customers: { phone: '+5511111111111' } },
      { customers: { phone: '+5511222222222' } },
      { customers: { phone: '+5511333333333' } },
    ]
    const supabase = makeSequentialMockSupabase(
      { data: menuItem, error: null }, // menu_items.single()
      { data: orders, error: null },   // orders list (direct await)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/morning-story')
    const res = await morningStory(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(3)
    expect(body.total).toBe(3)

    // sendMessage called 3 times — each with the morning_message text
    expect(sendMessage).toHaveBeenCalledTimes(3)
    const messages = vi.mocked(sendMessage).mock.calls.map(([, text]) => text)
    messages.forEach((text) => expect(text).toContain('Frango feito com carinho'))
  })

  it('[P1-012] uses fallback text when morning_message is null', async () => {
    const menuItem = {
      name: 'Feijoada',
      description: 'Completa e saborosa',
      morning_message: null,
    }
    const orders = [{ customers: { phone: '+5511111111111' } }]
    const supabase = makeSequentialMockSupabase(
      { data: menuItem, error: null },
      { data: orders, error: null },
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/morning-story')
    await morningStory(req)

    const [, text] = vi.mocked(sendMessage).mock.calls[0]
    expect(text).toContain('Feijoada')
    expect(text).toContain('Seu Laerte')
  })

  it('[P1-012] no menu item for today → 0 messages sent', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: null, error: { code: 'PGRST116' } }, // no menu item
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/morning-story')
    const res = await morningStory(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// P1-013: rating-prompt
// ---------------------------------------------------------------------------

describe('GET /api/cron/rating-prompt', () => {
  it('[P1-013] sends prompts sequentially and marks rating_prompt_sent_at per order', async () => {
    const orders = [
      { id: 10, display_id: '0010', customers: { phone: '+5511111111111' } },
      { id: 11, display_id: '0011', customers: { phone: '+5511222222222' } },
    ]
    const supabase = makeSequentialMockSupabase(
      { data: orders, error: null },    // orders list
      { data: null, error: null },       // update order 10
      { data: null, error: null },       // update order 11
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/rating-prompt')
    const res = await ratingPrompt(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(2)

    expect(sendMessage).toHaveBeenCalledTimes(2)
    // Each message contains the rating URL with display_id
    const calls = vi.mocked(sendMessage).mock.calls
    expect(calls[0][1]).toContain('/rate/0010')
    expect(calls[1][1]).toContain('/rate/0011')

    // rating_prompt_sent_at updated for both orders
    expect(supabase.update).toHaveBeenCalledTimes(2)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ rating_prompt_sent_at: expect.any(String) }),
    )
  })

  it('[P1-013] sendMessage failure → order is NOT marked as sent (idempotency guard)', async () => {
    const orders = [
      { id: 10, display_id: '0010', customers: { phone: '+5511111111111' } },
    ]
    const supabase = makeSequentialMockSupabase(
      { data: orders, error: null },
      { data: null, error: null }, // update (would be called if send succeeded)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('Z-API error'))

    const req = makeCronRequest('/api/cron/rating-prompt')
    const res = await ratingPrompt(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)

    // Update was NOT called because send failed
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('[P1-013] no eligible orders → 0 sent', async () => {
    const supabase = makeSequentialMockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/rating-prompt')
    const res = await ratingPrompt(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// P1-015: menu-reveal
// ---------------------------------------------------------------------------

describe('GET /api/cron/menu-reveal', () => {
  it('[P1-015] no next-week menu → returns ok with sent=0 and reason=no-menu', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: [], error: null }, // no menu items for next week
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/menu-reveal')
    const res = await menuReveal(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(body.reason).toBe('no-menu')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('[P1-015] next-week menu exists → sends to all consenting customers', async () => {
    const items = [
      { delivery_date: '2026-04-20', name: 'Frango Grelhado' },
      { delivery_date: '2026-04-21', name: 'Feijoada' },
    ]
    const customers = [
      { phone: '+5511111111111' },
      { phone: '+5511222222222' },
      { phone: '+5511333333333' },
    ]
    const supabase = makeSequentialMockSupabase(
      { data: items, error: null },     // menu items query
      { data: customers, error: null }, // customers query
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/menu-reveal')
    const res = await menuReveal(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(3)
    expect(body.total).toBe(3)

    expect(sendMessage).toHaveBeenCalledTimes(3)
    // Each message contains the menu items
    const [, text] = vi.mocked(sendMessage).mock.calls[0]
    expect(text).toContain('Frango Grelhado')
    expect(text).toContain('Cardápio')
  })

  it('[P1-015] no consenting customers → 0 messages', async () => {
    const items = [{ delivery_date: '2026-04-20', name: 'Frango' }]
    const supabase = makeSequentialMockSupabase(
      { data: items, error: null },
      { data: [], error: null }, // no customers with consent
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const req = makeCronRequest('/api/cron/menu-reveal')
    const res = await menuReveal(req)

    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('no auth header → 401', async () => {
    const req = makeUnauthedCronRequest('/api/cron/menu-reveal')
    const res = await menuReveal(req)
    expect(res.status).toBe(401)
  })
})
