// @vitest-environment node
/**
 * P0 tests for route protection via proxy.ts:
 *   P0-012  Unauthenticated request to /order → redirect to /login?from=/order
 *   P0-013  Non-admin authenticated request to /admin/menu → redirect to /
 *
 * Additional coverage:
 *   - Authenticated user on /login → redirect to /
 *   - Admin user on /admin → passes through
 *   - Public routes (/menu) without session → passes through (no redirect)
 *   - Protected paths without session: /checkout, /rate, /conta
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock @/lib/session — prevents `server-only` import error and lets us
// control decrypt output per test
// ---------------------------------------------------------------------------

vi.mock('@/lib/session', () => ({
  decrypt: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
}))

import { proxy } from '@/proxy'
import { decrypt } from '@/lib/session'
import type { SessionPayload } from '@/lib/session'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, sessionToken?: string): NextRequest {
  const url = `http://localhost:3000${path}`
  const headers: Record<string, string> = {}
  if (sessionToken) {
    headers['Cookie'] = `session=${sessionToken}`
  }
  return new NextRequest(url, { headers })
}

const validSession: SessionPayload = { customerId: 1, phone: '+5511999999999' }
const adminSession: SessionPayload = { customerId: 99, phone: '+5511000000000' }

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no valid session (decrypt returns null)
  vi.mocked(decrypt).mockResolvedValue(null)
  process.env.LAERTE_PHONE = adminSession.phone
  process.env.SESSION_SECRET = 'test-secret-32-chars-minimum-ok'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LAERTE_PHONE
  delete process.env.SESSION_SECRET
})

// ---------------------------------------------------------------------------
// Route protection — unauthenticated
// ---------------------------------------------------------------------------

describe('proxy — unauthenticated access to protected routes', () => {
  it('[P0-012] GET /order without session → redirect to /login?from=/order', async () => {
    const req = makeRequest('/order')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('from=%2Forder')
  })

  it('[P0-012] GET /order/status without session → redirect to /login', async () => {
    const req = makeRequest('/order/status')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('[P0-012] GET /checkout/0042 without session → redirect to /login', async () => {
    const req = makeRequest('/checkout/0042')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('[P0-012] GET /admin/menu without session → redirect to /login', async () => {
    const req = makeRequest('/admin/menu')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('[P0-012] GET /rate/0042 without session → redirect to /login', async () => {
    const req = makeRequest('/rate/0042')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('[P0-012] GET /conta/deletar without session → redirect to /login', async () => {
    const req = makeRequest('/conta/deletar')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// Admin protection — authenticated but non-admin
// ---------------------------------------------------------------------------

describe('proxy — admin route protection', () => {
  it('[P0-013] non-admin authenticated user on /admin/menu → redirect to /', async () => {
    vi.mocked(decrypt).mockResolvedValue(validSession) // non-admin phone
    const req = makeRequest('/admin/menu', 'fake-session-token')

    const res = await proxy(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).toBe('http://localhost:3000/')
  })

  it('[P0-013] non-admin on /admin/orders → redirect to /', async () => {
    vi.mocked(decrypt).mockResolvedValue(validSession)
    const req = makeRequest('/admin/orders', 'fake-session-token')

    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('admin user on /admin/menu → passes through (no redirect)', async () => {
    vi.mocked(decrypt).mockResolvedValue(adminSession)
    const req = makeRequest('/admin/menu', 'admin-session-token')

    const res = await proxy(req)

    // NextResponse.next() returns a response without a redirect Location header
    expect(res.headers.get('location')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Public routes — no protection needed
// ---------------------------------------------------------------------------

describe('proxy — public routes pass through', () => {
  it('GET /menu without session → no redirect', async () => {
    const req = makeRequest('/menu')
    const res = await proxy(req)

    expect(res.headers.get('location')).toBeNull()
  })

  it('GET / without session → no redirect', async () => {
    const req = makeRequest('/')
    const res = await proxy(req)

    expect(res.headers.get('location')).toBeNull()
  })

  it('GET /privacy without session → no redirect', async () => {
    const req = makeRequest('/privacy')
    const res = await proxy(req)

    expect(res.headers.get('location')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Authenticated user on /login → redirect to /
// ---------------------------------------------------------------------------

describe('proxy — authenticated user on /login', () => {
  it('authenticated user visiting /login → redirect to /', async () => {
    vi.mocked(decrypt).mockResolvedValue(validSession)
    const req = makeRequest('/login', 'some-session-token')

    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })
})
