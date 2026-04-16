/**
 * P0-008  First checkout visit initialises pix_expires_at and sets pix_key
 * P1-002  Pix key and countdown timer visible for aguardando_pagamento orders
 * P1-005  Confirmed order shows confirmation message
 * P0-009  Cancelled order shows cancelled state
 *
 * Seeds: customer → menu week/item → order, then visits /checkout/[displayId]
 * with a forged session cookie matching the customer's phone.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { makeSessionCookie } from '../helpers/session'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PIX_KEY = process.env.PIX_KEY ?? '11999999999'

const CUSTOMER_PHONE = '+5511000000003'
const DELIVERY_DATE = '2099-02-05' // far future, won't clash with other tests

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Shared seed/teardown
// ---------------------------------------------------------------------------

let customerId: number
let menuItemId: number
let pendingOrderDisplayId: string
let confirmedOrderDisplayId: string
let cancelledOrderDisplayId: string

test.beforeAll(async () => {
  const db = supabase()

  // 1. Customer
  const { data: customer } = await db
    .from('customers')
    .upsert(
      { phone: CUSTOMER_PHONE, name: 'Checkout Test Customer', whatsapp_consent: false },
      { onConflict: 'phone' },
    )
    .select('id')
    .single()
  customerId = customer!.id as number

  // 2. Menu week + item
  const { data: week } = await db
    .from('menu_weeks')
    .upsert({ week_start: '2099-02-03' }, { onConflict: 'week_start' })
    .select('id')
    .single()
  const weekId = week!.id as number

  // Delete any leftover from prior runs, then insert fresh
  await db.from('menu_items').delete().eq('menu_week_id', weekId).eq('delivery_date', DELIVERY_DATE)
  const { data: item } = await db
    .from('menu_items')
    .insert({
      menu_week_id: weekId,
      delivery_date: DELIVERY_DATE,
      name: 'Frango Ensopado',
      description: 'Frango cozido com batata e cenoura.',
    })
    .select('id')
    .single()
  menuItemId = item!.id as number

  // Clean up any leftover orders from prior runs
  await db.from('orders').delete().eq('customer_id', customerId)

  // 3. Pending (aguardando_pagamento) order — no pix_expires_at yet so the
  //    checkout page initialises it on first visit (P0-008)
  const { data: pendingOrder } = await db
    .from('orders')
    .insert({
      display_id: 'C001',
      customer_id: customerId,
      menu_item_id: menuItemId,
      delivery_date: DELIVERY_DATE,
      status: 'aguardando_pagamento',
    })
    .select('display_id')
    .single()
  pendingOrderDisplayId = pendingOrder!.display_id as string

  // 4. Confirmed order
  const { data: confirmedOrder } = await db
    .from('orders')
    .insert({
      display_id: 'C002',
      customer_id: customerId,
      menu_item_id: menuItemId,
      delivery_date: DELIVERY_DATE,
      status: 'confirmado',
    })
    .select('display_id')
    .single()
  confirmedOrderDisplayId = confirmedOrder!.display_id as string

  // 5. Cancelled order
  const { data: cancelledOrder } = await db
    .from('orders')
    .insert({
      display_id: 'C003',
      customer_id: customerId,
      menu_item_id: menuItemId,
      delivery_date: DELIVERY_DATE,
      status: 'cancelado',
    })
    .select('display_id')
    .single()
  cancelledOrderDisplayId = cancelledOrder!.display_id as string
})

test.afterAll(async () => {
  const db = supabase()
  await db.from('orders').delete().eq('customer_id', customerId)
  await db.from('menu_items').delete().eq('id', menuItemId)
  await db.from('menu_weeks').delete().eq('week_start', '2099-02-03')
  await db.from('customers').delete().eq('phone', CUSTOMER_PHONE)
})

async function sessionCookie(page: import('@playwright/test').Page) {
  const token = await makeSessionCookie(CUSTOMER_PHONE, customerId)
  await page.context().addCookies([
    {
      name: 'session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

// ---------------------------------------------------------------------------
// P0-008 + P1-002: aguardando_pagamento — Pix key and countdown visible
// ---------------------------------------------------------------------------

test.describe('@P0 @P1 @E2E checkout — aguardando_pagamento', () => {
  test('[P0-008][P1-002] first visit initialises pix key and shows countdown timer', async ({
    page,
  }) => {
    await sessionCookie(page)

    const response = await page.goto(`/checkout/${pendingOrderDisplayId}`)

    expect(response?.status()).toBe(200)

    // Order header
    await expect(page.getByRole('heading', { name: `#${pendingOrderDisplayId}` })).toBeVisible()

    // Dish name
    await expect(page.getByText('Frango Ensopado')).toBeVisible()

    // Price (appears in the order summary card)
    await expect(page.getByText('R$\u00A035,00').first()).toBeVisible()

    // Countdown timer label
    await expect(page.getByText('Tempo restante para pagar')).toBeVisible()

    // Pix key section
    await expect(page.getByText('Chave Pix', { exact: true })).toBeVisible()
    await expect(page.getByText(PIX_KEY)).toBeVisible()

    // Cancel button present
    await expect(page.getByRole('button', { name: /cancelar/i })).toBeVisible()
  })

  test('[P0-008] pix_expires_at is set in DB after first visit', async ({ page }) => {
    await sessionCookie(page)
    await page.goto(`/checkout/${pendingOrderDisplayId}`)

    // Give the page time to run the server-side update
    await page.waitForLoadState('networkidle')

    const db = supabase()
    const { data: order } = await db
      .from('orders')
      .select('pix_expires_at, pix_key')
      .eq('display_id', pendingOrderDisplayId)
      .single()

    expect(order!.pix_expires_at).not.toBeNull()
    expect(order!.pix_key).toBe(PIX_KEY)

    // Expiry should be ~30 minutes from now (allow ±2 min for test timing)
    const expiry = new Date(order!.pix_expires_at as string).getTime()
    const now = Date.now()
    expect(expiry).toBeGreaterThan(now + 28 * 60 * 1000)
    expect(expiry).toBeLessThan(now + 32 * 60 * 1000)
  })
})

// ---------------------------------------------------------------------------
// Confirmed order — confirmation message
// ---------------------------------------------------------------------------

test.describe('@P1 @E2E checkout — confirmado', () => {
  test('confirmed order shows confirmation message, not Pix key', async ({ page }) => {
    await sessionCookie(page)

    await page.goto(`/checkout/${confirmedOrderDisplayId}`)

    await expect(page.getByText('Pedido confirmado!')).toBeVisible()

    // Pix key section must NOT be present
    await expect(page.getByText('Chave Pix')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Cancelled order — cancelled state
// ---------------------------------------------------------------------------

test.describe('@P0 @E2E checkout — cancelado', () => {
  test('[P0-009] cancelled order shows cancellation state, not Pix key', async ({ page }) => {
    await sessionCookie(page)

    await page.goto(`/checkout/${cancelledOrderDisplayId}`)

    await expect(page.getByText('Pedido cancelado.')).toBeVisible()

    // Pix key section must NOT be present
    await expect(page.getByText('Chave Pix')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Ownership guard — another customer cannot see someone else's order
// ---------------------------------------------------------------------------

test.describe('@P0 @E2E checkout — ownership', () => {
  test('customer cannot view another customer\'s order → 404', async ({ page }) => {
    // Forge a session for a different phone
    const strangerToken = await makeSessionCookie('+5511000000099', 9999)
    await page.context().addCookies([
      {
        name: 'session',
        value: strangerToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    const response = await page.goto(`/checkout/${pendingOrderDisplayId}`)

    // Page returns 404 (notFound()) when customer_id doesn't match
    expect(response?.status()).toBe(404)
  })
})
