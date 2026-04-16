/**
 * Factory for a mock Supabase client whose query chain resolves to
 * caller-supplied results, keyed by table name and operation.
 *
 * Supports all chain patterns used in the codebase:
 *   - .from(table).select(...).eq(...).single()
 *   - .from(table).select(...).maybeSingle()
 *   - .from(table).insert(...)
 *   - .from(table).upsert(...).select(...).single()
 *   - .from(table).update(...).eq(...)   ← awaited directly (thenable chain)
 *   - .rpc(name, args)
 */

import { vi } from 'vitest'

export type TableResult = { data: unknown; error: unknown }

export interface MockSupabaseOptions {
  /** Result for `.from('otp_codes').maybeSingle()` */
  otpCodesRow?: TableResult
  /** Result for `.from('customers').single()` */
  customersRow?: TableResult
  /** Result for `.from('orders').single()` */
  ordersRow?: TableResult
  /** Result for `.from('otp_codes').insert(...)` */
  otpInsert?: TableResult
  /** Result for `.from(...).update(...).eq(...)` (thenable chain) */
  updateResult?: TableResult
  /** Result for `.rpc('place_order', ...)` */
  placeOrderRpc?: TableResult
}

const DEFAULT: TableResult = { data: null, error: null }

/**
 * Sequential mock — each terminal DB call (`.single()`, `.maybySingle()`, or
 * a direct `await chain`) consumes the next entry from `results` in order.
 *
 * Use this for routes that make multiple distinct queries (cron handlers,
 * multi-step actions) where you need fine-grained per-call control.
 *
 * Example:
 *   makeSequentialMockSupabase(
 *     { data: menuItem, error: null },   // 1st call: menu_items.single()
 *     { data: orders,   error: null },   // 2nd call: orders list (direct await)
 *   )
 */
export function makeSequentialMockSupabase(...results: TableResult[]) {
  let idx = 0
  const next = (): TableResult => results[idx++] ?? { data: null, error: null }

  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(next())),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(next())),
    rpc: vi.fn().mockImplementation(() => Promise.resolve(next())),
    // Direct `await chain` — covers list queries and `update().eq()` patterns
    then: vi.fn().mockImplementation(
      (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(next()).then(resolve, reject),
    ),
    catch: vi.fn().mockImplementation((reject: (e: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).catch(reject),
    ),
  }
  return chain
}

export function makeMockSupabase(opts: MockSupabaseOptions = {}) {
  let currentTable = ''
  const {
    otpCodesRow = DEFAULT,
    customersRow = DEFAULT,
    ordersRow = DEFAULT,
    otpInsert = DEFAULT,
    updateResult = DEFAULT,
    placeOrderRpc = DEFAULT,
  } = opts

  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      currentTable = table
      return chain
    }),
    select: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => Promise.resolve(otpInsert)),
    upsert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    neq: vi.fn().mockImplementation(() => chain),
    is: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => {
      if (currentTable === 'customers') return Promise.resolve(customersRow)
      if (currentTable === 'orders') return Promise.resolve(ordersRow)
      return Promise.resolve(DEFAULT)
    }),
    maybeSingle: vi.fn().mockImplementation(() => {
      if (currentTable === 'otp_codes') return Promise.resolve(otpCodesRow)
      return Promise.resolve(DEFAULT)
    }),
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'place_order') return Promise.resolve(placeOrderRpc)
      return Promise.resolve(DEFAULT)
    }),
    // Thenable — lets `await update().eq()` resolve correctly
    then: vi.fn().mockImplementation(
      (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(updateResult).then(resolve, reject),
    ),
    catch: vi.fn().mockImplementation((reject: (e: unknown) => void) =>
      Promise.resolve(updateResult).catch(reject),
    ),
  }

  return chain
}
