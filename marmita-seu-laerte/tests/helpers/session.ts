/**
 * Test helper — forge a signed session JWT using the test SESSION_SECRET.
 * Mirrors the logic in src/lib/session.ts without importing server-only code.
 */
import { SignJWT } from 'jose'

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-chars-long!!'
const SESSION_SECONDS = 30 * 24 * 60 * 60

export async function makeSessionCookie(phone: string, customerId = 1): Promise<string> {
  const key = new TextEncoder().encode(SESSION_SECRET)
  return new SignJWT({ customerId, phone } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(key)
}
