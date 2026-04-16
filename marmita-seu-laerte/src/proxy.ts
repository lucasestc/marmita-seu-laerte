import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

// Routes that require an authenticated session
function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/order') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/rate') ||
    pathname.startsWith('/conta')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Read session token directly from request cookies (no async cookies() here)
  const token = request.cookies.get('session')?.value
  const session = token ? await decrypt(token) : null

  // Redirect unauthenticated users away from protected routes.
  // Note: `pathname` does not include query params — they are lost after login.
  // Acceptable for MVP; revisit when deep-linked order URLs exist.
  if (isProtectedPath(pathname) && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes require the session phone to match LAERTE_PHONE.
  // Non-admin authenticated users are silently redirected to home.
  if (pathname.startsWith('/admin') && session) {
    const adminPhone = process.env.LAERTE_PHONE
    if (!adminPhone || session.phone !== adminPhone) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Redirect authenticated users away from /login
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next.js internals and static files.
     * _next/data routes are intentionally NOT excluded so that protected
     * page data fetches are also guarded.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
