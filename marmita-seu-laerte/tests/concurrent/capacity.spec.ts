/**
 * P0-010 Concurrent capacity race condition test
 *
 * Seeds the test DB with:
 *   - 1 customer
 *   - 1 menu week + item for a future delivery date
 *   - 99 confirmed orders for that date (1 slot remaining)
 *
 * Then fires 10 simultaneous place_order requests and asserts exactly 1 succeeds.
 * Run 5 times (--repeat-each=5) on CI to catch intermittent races.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (from .env.test)
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// A future Monday that won't clash with real data
const TEST_DELIVERY_DATE = '2099-01-07'
const CAPACITY = 100

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

async function seed() {
  const db = supabase()

  // 1. Upsert test customer
  const { data: customer } = await db
    .from('customers')
    .upsert({ phone: '+5511000000001', name: 'Test Customer', whatsapp_consent: false }, { onConflict: 'phone' })
    .select('id')
    .single()
  const customerId = customer!.id as number

  // 2. Upsert menu week + item
  const { data: week } = await db
    .from('menu_weeks')
    .upsert({ week_start: '2099-01-06' }, { onConflict: 'week_start' })
    .select('id')
    .single()
  const weekId = week!.id as number

  await db.from('menu_items').delete().eq('menu_week_id', weekId).eq('delivery_date', TEST_DELIVERY_DATE)
  const { data: item } = await db
    .from('menu_items')
    .insert({ menu_week_id: weekId, delivery_date: TEST_DELIVERY_DATE, name: 'Prato Teste' })
    .select('id')
    .single()
  const menuItemId = item!.id as number

  // 3. Delete leftover orders from prior runs for this date
  await db.from('orders').delete().eq('delivery_date', TEST_DELIVERY_DATE)

  // 4. Seed 99 confirmed orders (leaves exactly 1 slot)
  const fakeOrders = Array.from({ length: CAPACITY - 1 }, (_, i) => ({
    display_id: `T${String(i + 1).padStart(3, '0')}`,
    customer_id: customerId,
    menu_item_id: menuItemId,
    delivery_date: TEST_DELIVERY_DATE,
    status: 'confirmado',
  }))
  await db.from('orders').insert(fakeOrders)

  return { customerId, menuItemId }
}

async function cleanup() {
  const db = supabase()
  await db.from('orders').delete().eq('delivery_date', TEST_DELIVERY_DATE)
  await db.from('menu_items').delete().eq('delivery_date', TEST_DELIVERY_DATE)
  await db.from('menu_weeks').delete().eq('week_start', '2099-01-06')
  await db.from('customers').delete().eq('phone', '+5511000000001')
}

test('@P0 @Concurrent exactly 1 of 10 concurrent place_order calls succeeds when 1 slot remains', async () => {
  const { customerId, menuItemId } = await seed()

  // Fire 10 simultaneous Supabase RPC calls to place_order.
  // Each uses its own client (own DB connection) to simulate true concurrent callers.
  // The advisory lock inside the RPC serialises the capacity check + insert.
  const rpcCalls = Array.from({ length: 10 }, (_, i) =>
    createClient(SUPABASE_URL, SERVICE_ROLE_KEY).rpc('place_order', {
      p_customer_id: customerId,
      p_menu_item_id: menuItemId,
      p_delivery_date: TEST_DELIVERY_DATE,
    }),
  )

  const results = await Promise.all(rpcCalls)

  await cleanup()

  const successes = results.filter((r) => {
    if (r.error) return false
    const data = r.data as { success: boolean } | null
    return data?.success === true
  })

  // Exactly one call should have created an order
  expect(successes.length).toBe(1)
})
