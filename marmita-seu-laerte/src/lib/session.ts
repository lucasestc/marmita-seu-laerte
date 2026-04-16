import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export type SessionPayload = {
  customerId: number
  phone: string
}

const COOKIE_NAME = 'session'
const SESSION_SECONDS = 30 * 24 * 60 * 60 // 30 days

function getKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(getKey())
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Sets the session cookie from a Server Action. */
export async function createSession(customerId: number, phone: string): Promise<void> {
  const token = await encrypt({ customerId, phone })
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_SECONDS,
    path: '/',
  })
}

/** Reads and verifies the session cookie. Returns null if absent or invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return decrypt(token)
}
