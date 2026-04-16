/**
 * P0-012  Unauthenticated access to /order → redirect to /login?from=/order
 * P0-013  Non-admin authenticated user on /admin/menu → redirect to /
 *         Admin user on /admin/menu → passes through (200)
 */

import { test, expect } from '@playwright/test'
import { makeSessionCookie } from '../helpers/session'

const LAERTE_PHONE = process.env.LAERTE_PHONE ?? '+5511900000000'
const NON_ADMIN_PHONE = '+5511999999999'

// ---------------------------------------------------------------------------
// P0-012: Unauthenticated route protection
// ---------------------------------------------------------------------------

test.describe('@P0 @E2E @Routes unauthenticated route protection', () => {
  test('[P0-012] GET /order without session → redirect to /login?from=/order', async ({ page }) => {
    // Ensure no session cookie is present
    await page.context().clearCookies()

    const response = await page.goto('/order')

    expect(page.url()).toContain('/login')
    expect(page.url()).toContain('from=%2Forder')
    // Should not be a server error
    expect(response?.status()).not.toBe(500)
  })

  test('[P0-012] GET /checkout/0001 without session → redirect to /login', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/checkout/0001')

    expect(page.url()).toContain('/login')
  })

  test('[P0-012] GET /conta/deletar without session → redirect to /login', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/conta/deletar')

    expect(page.url()).toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// P0-013: Admin route protection
// ---------------------------------------------------------------------------

test.describe('@P0 @E2E @Routes admin route protection', () => {
  test('[P0-013] non-admin authenticated user on /admin/menu → redirect to /', async ({
    page,
  }) => {
    const token = await makeSessionCookie(NON_ADMIN_PHONE)
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

    await page.goto('/admin/menu')

    // Should be redirected away from /admin (proxy → / → /menu)
    expect(page.url()).not.toContain('/admin')
  })

  test('[P0-013] admin user on /admin/menu → passes through (not redirected)', async ({
    page,
  }) => {
    const token = await makeSessionCookie(LAERTE_PHONE)
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

    const response = await page.goto('/admin/menu')

    // Should not be redirected away from /admin
    expect(new URL(page.url()).pathname).toMatch(/^\/admin/)
    expect(response?.status()).not.toBe(500)
  })

  test('authenticated non-admin on /login → redirect to /', async ({ page }) => {
    const token = await makeSessionCookie(NON_ADMIN_PHONE)
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

    await page.goto('/login')

    // proxy redirects to / which itself redirects to /menu
    expect(page.url()).not.toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// Public routes — should never redirect unauthenticated users
// ---------------------------------------------------------------------------

test.describe('@P0 @E2E @Routes public routes', () => {
  test('GET /menu without session → accessible (no redirect)', async ({ page }) => {
    await page.context().clearCookies()

    const response = await page.goto('/menu')

    expect(page.url()).not.toContain('/login')
    expect(response?.status()).toBe(200)
  })

  test('GET / without session → accessible (no redirect)', async ({ page }) => {
    await page.context().clearCookies()

    const response = await page.goto('/')

    expect(page.url()).not.toContain('/login')
    expect(response?.status()).toBe(200)
  })
})
