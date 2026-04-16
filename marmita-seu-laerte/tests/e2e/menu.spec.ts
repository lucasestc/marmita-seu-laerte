/**
 * P1-004  Public menu page — dish names visible without auth
 * P1-005  Full day shows "Esgotado" label
 * P2-007  /privacidade accessible without auth (200, content visible)
 * P2-010  /menu has correct <title> and <meta description>, not noindex
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

// Seed a menu week for the current week so the menu page has data to show.
// Uses a Monday that is always "this week" relative to test execution.
function thisWeekMonday(): string {
  const now = new Date()
  const dow = now.getUTCDay() // 0 = Sunday
  const daysToMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysToMonday)
  return monday.toISOString().split('T')[0]
}

function nextDateFrom(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

const WEEK_START = thisWeekMonday()
const DELIVERY_DATE = nextDateFrom(WEEK_START, 2) // Wednesday

let seededMenuWeekId: number
let seededMenuItemId: number
let seededCustomerId: number

test.beforeAll(async () => {
  const db = supabase()

  // Upsert menu week
  const { data: week } = await db
    .from('menu_weeks')
    .upsert({ week_start: WEEK_START }, { onConflict: 'week_start' })
    .select('id')
    .single()
  seededMenuWeekId = week!.id as number

  // Insert menu item (delete any leftover from prior runs first)
  await db.from('menu_items').delete().eq('menu_week_id', seededMenuWeekId).eq('delivery_date', DELIVERY_DATE)
  const { data: item } = await db
    .from('menu_items')
    .insert({
      menu_week_id: seededMenuWeekId,
      delivery_date: DELIVERY_DATE,
      name: 'Frango Caipira ao Molho',
      description: 'Frango caipira cozido lentamente com legumes da roça.',
    })
    .select('id')
    .single()
  seededMenuItemId = item!.id as number

  // Upsert a test customer (for sold-out seeding in P1-005)
  const { data: customer } = await db
    .from('customers')
    .upsert(
      { phone: '+5511000000002', name: 'Menu Test Customer', whatsapp_consent: false },
      { onConflict: 'phone' },
    )
    .select('id')
    .single()
  seededCustomerId = customer!.id as number
})

test.afterAll(async () => {
  const db = supabase()
  await db.from('orders').delete().eq('menu_item_id', seededMenuItemId)
  await db.from('menu_items').delete().eq('id', seededMenuItemId)
  await db.from('menu_weeks').delete().eq('id', seededMenuWeekId)
  await db.from('customers').delete().eq('phone', '+5511000000002')
})

// ---------------------------------------------------------------------------
// P1-004: Public menu page — dish names visible without auth
// ---------------------------------------------------------------------------

test.describe('@P1 @E2E public menu page', () => {
  test('[P1-004] GET /menu without auth → shows dish name', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/menu')

    await expect(page.getByText('Frango Caipira ao Molho')).toBeVisible()
    // Should not redirect to login
    expect(page.url()).not.toContain('/login')
  })

  test('[P1-004] /menu shows the brand header', async ({ page }) => {
    await page.goto('/menu')

    await expect(page.getByRole('heading', { name: 'Marmita do Seu Laerte' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// P1-005: Sold-out day shows "Esgotado"
// ---------------------------------------------------------------------------

test.describe('@P1 @E2E sold-out display', () => {
  test('[P1-005] day with 100 confirmed orders shows "Esgotado"', async ({ page }) => {
    const db = supabase()

    // Seed 100 confirmed orders for the test item
    await db.from('orders').delete().eq('menu_item_id', seededMenuItemId)
    const soldOutOrders = Array.from({ length: 100 }, (_, i) => ({
      display_id: `S${String(i + 1).padStart(3, '0')}`,
      customer_id: seededCustomerId,
      menu_item_id: seededMenuItemId,
      delivery_date: DELIVERY_DATE,
      status: 'confirmado',
    }))
    await db.from('orders').insert(soldOutOrders)

    await page.goto('/menu')

    await expect(page.getByText('Esgotado').first()).toBeVisible()

    // Cleanup
    await db.from('orders').delete().eq('menu_item_id', seededMenuItemId)
  })
})

// ---------------------------------------------------------------------------
// P2-007: /privacidade accessible without auth
// ---------------------------------------------------------------------------

test.describe('@P2 @E2E privacy policy', () => {
  test('[P2-007] GET /privacidade without session → 200, content visible', async ({ page }) => {
    await page.context().clearCookies()

    const response = await page.goto('/privacidade')

    expect(response?.status()).toBe(200)
    expect(page.url()).not.toContain('/login')
    await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// P2-010: /menu SEO meta tags
// ---------------------------------------------------------------------------

test.describe('@P2 @E2E SEO', () => {
  test('[P2-010] /menu has correct <title> and <meta description>, not noindex', async ({
    page,
  }) => {
    await page.goto('/menu')

    const title = await page.title()
    expect(title).toContain('Cardápio')
    expect(title).toContain('Marmita do Seu Laerte')

    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute('content')
    expect(metaDescription).toBeTruthy()
    expect(metaDescription!.length).toBeGreaterThan(20)

    // Must NOT be noindex — absence of the meta tag is fine (means indexed)
    const robotsCount = await page.locator('meta[name="robots"]').count()
    if (robotsCount > 0) {
      const robots = await page.locator('meta[name="robots"]').getAttribute('content')
      expect(robots ?? '').not.toContain('noindex')
    }
    // If no robots meta tag exists, the page is indexed by default — test passes
  })
})
