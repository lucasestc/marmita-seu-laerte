---
story_key: "1-3-otp-verification-session"
epic: 1
story: 1.3
status: review
---

# Story 1.3: OTP Verification, Session Creation & Route Protection

## Story

As a customer who received an OTP via WhatsApp,
I want to enter my code and be logged in for 30 days,
So that I can access the ordering flow without re-authenticating each visit.

## Acceptance Criteria

**AC1:** Given the correct 6-digit code entered within 10 minutes — Server Action queries `otp_codes` for the most recent unused row for that phone, bcrypt-compares the code, marks `used_at`, upserts the customer (setting `whatsapp_consent = true` on first login), sets a 30-day session cookie, and redirects to `/` (or the originally requested URL via `?from=`).

**AC2:** Given an incorrect code — returns `{ success: false, error: 'Código inválido. Verifique e tente novamente.' }`. `otp_codes` row is NOT marked used.

**AC3:** Given an expired OTP (> 10 minutes) — returns `{ success: false, error: 'Código expirado. Solicite um novo código.' }`.

**AC4:** Given "Reenviar código" tapped — calls `requestOtp` again (from Story 1.2), new 10-minute OTP sent.

**AC5:** Given a valid session cookie on `/login` — `proxy.ts` redirects to `/`.

**AC6:** Given no session cookie on `/order/*`, `/checkout/*`, or `/admin/*` — `proxy.ts` redirects to `/login?from=/original-path`.

## Tasks / Subtasks

- [x] **Task 1: Session library**
  - [x] Create `src/lib/session.ts` with `encrypt`, `decrypt`, `createSession`, `getSession`
  - [x] JWT via `jose` (HS256), cookie name `session`, 30-day `maxAge`
  - [x] `SESSION_SECRET` env var required

- [x] **Task 2: `verifyOtp` Server Action**
  - [x] Add `verifyOtp(phone, code, from)` to `src/actions/auth.ts`
  - [x] Zod schema: validates E.164 phone, 6-digit code
  - [x] Queries `otp_codes` (unused, ordered by `created_at DESC`)
  - [x] Checks expiry, bcrypt-compares, marks `used_at`
  - [x] Upserts customer with `whatsapp_consent: true`
  - [x] Calls `createSession`, then `redirect(safeFrom)`
  - [x] Open-redirect guard on `from` param

- [x] **Task 3: `OtpInput` component**
  - [x] Create `src/components/ui/otp-input.tsx`
  - [x] 6 individual inputs, controlled by `value` / `onChange`
  - [x] Auto-advance on digit entry, backspace navigation, arrow key navigation
  - [x] Paste support (splits across boxes), `autoComplete="one-time-code"` on box 0
  - [x] `hasError` prop styles boxes red when set

- [x] **Task 4: Replace OTP placeholder in `LoginFlow.tsx`**
  - [x] `OtpStep` replaced with real OtpInput + "Entrar" button
  - [x] Separate `useTransition` pairs for verify and resend
  - [x] Error states: `otpError` (verify), `resendError` / `resendSuccess` (resend)
  - [x] Button disabled until all 6 digits entered
  - [x] `from` prop threaded from `LoginFlow` → `OtpStep` → `verifyOtp`

- [x] **Task 5: Update login page to forward `?from`**
  - [x] `src/app/(auth)/login/page.tsx` now async, reads `searchParams.from`, passes to `LoginFlow`

- [x] **Task 6: `src/proxy.ts` (Middleware → Proxy, Next.js 16)**
  - [x] Named export `proxy` (Next.js 16 renamed middleware → proxy, file is `proxy.ts`)
  - [x] Protected: `/order/*`, `/checkout/*`, `/admin/*` → redirect to `/login?from=…`
  - [x] Login redirect: `/login` + valid session → redirect to `/`
  - [x] Matcher: excludes `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`

- [x] **Task 7: TypeScript check**
  - [x] `npx tsc --noEmit` — zero errors

## Dev Notes

### Technical Context

**Stack:** Next.js 16.2.3 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui, Zod, jose

**New package:** `jose@6.2.2` — JWT signing/verification (HS256). Required env var: `SESSION_SECRET` (32+ character random string, e.g. `openssl rand -base64 32`).

**Session payload:** `{ customerId: number, phone: string }` — minimal, no PII beyond what's needed for identity.

**Next.js 16 breaking change — Proxy:**
- `middleware.ts` is deprecated and renamed to `proxy.ts`
- Export function renamed from `middleware` to `proxy`
- `middleware` file convention still works for backward compat, but `proxy.ts` is the canonical form
- Runtime: Node.js (not Edge) by default in Next.js 16

**`verifyOtp` redirect pattern:**
- On success, `redirect()` from `next/navigation` throws `NEXT_REDIRECT` — React/Next.js intercepts on the client and performs navigation
- The `await verifyOtp(...)` in the client transition never returns a value on success
- Client code after the await only executes on failure (when the action returns `ActionResult`)

**OtpInput controlled pattern:**
- Parent owns the `value` string (up to 6 digits); `onChange` receives the new full string
- `handleChange` uses `raw.replace(/\D/g, '')` to handle mobile autocomplete delivering multiple digits at once
- `onFocus={e.target.select()}` allows replacing an existing digit by typing a new one
- `autoComplete="one-time-code"` on box 0 enables iOS/Android SMS autofill

**Session cookie options:**
- `httpOnly: true` — not accessible to client-side JS
- `secure: true` in production only (allows local dev over HTTP)
- `sameSite: 'lax'` — safe default, allows top-level navigation from external links
- `maxAge: 2592000` (30 days in seconds)

**`getSession()` for server components (future stories):**
```ts
import { getSession } from '@/lib/session'
const session = await getSession() // { customerId, phone } | null
```

**Open-redirect guard:** `from` is validated to start with `/` and not start with `//` before passing to `redirect()`.

## Dev Agent Record

### Implementation Plan

1. `jose` install → needed by session.ts
2. `session.ts` → encrypt/decrypt/createSession/getSession
3. `verifyOtp` in `auth.ts` → depends on session.ts, bcrypt, service client
4. `OtpInput` component → standalone UI, no action dependency
5. `LoginFlow.tsx` → depends on OtpInput + verifyOtp
6. Login page update → thin wrapper change
7. `proxy.ts` → depends on decrypt from session.ts
8. `tsc --noEmit` → final validation

### Debug Log

- **Next.js 16 Proxy:** Middleware is renamed to Proxy in Next.js 16. File must be `proxy.ts` (inside `src/`). Named export must be `proxy`. Confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **`cookies()` in proxy:** Proxy can use `next/headers` `cookies()`, but `request.cookies.get('session')?.value` is more idiomatic for proxy since the request object is already available.
- **`jose` SignJWT payload type:** `SignJWT` expects `Record<string, unknown>` for the payload; cast `SessionPayload` with `as unknown as Record<string, unknown>` to satisfy TypeScript without losing type safety.

### Completion Notes

- Session: stateless JWT (HS256 via `jose`), cookie `session`, 30-day `maxAge`. `SESSION_SECRET` env var must be set.
- `verifyOtp`: validates E.164 phone + 6-digit code, queries most recent unused OTP row, checks expiry, bcrypt-compares, marks `used_at`, upserts customer with `whatsapp_consent: true`, calls `createSession`, redirects with open-redirect guard.
- `OtpInput`: 6 controlled boxes with auto-advance, backspace nav, arrow nav, paste, iOS autofill.
- `LoginFlow` OtpStep: two independent `useTransition` pairs (verify/resend), button disabled until 6 digits entered, errors cleared on OTP change.
- `proxy.ts`: protects `/order/*`, `/checkout/*`, `/admin/*`; redirects authed users from `/login`. Excludes static assets from matcher.
- `npx tsc --noEmit` passes with zero errors.

## File List

- `src/lib/session.ts` (new)
- `src/actions/auth.ts` (modified — added `verifyOtp`)
- `src/components/ui/otp-input.tsx` (new)
- `src/components/features/LoginFlow.tsx` (modified — replaced OTP placeholder)
- `src/app/(auth)/login/page.tsx` (modified — async, reads `searchParams.from`)
- `src/proxy.ts` (new)
- `package.json` (modified — added `jose`)

## Environment Variables Required

```bash
# Add to .env.local — generate with: openssl rand -base64 32
SESSION_SECRET=your_32_char_random_secret_here
```

## Change Log

- 2026-04-11: Story created and implemented — all 7 tasks complete, all ACs satisfied, `tsc --noEmit` clean.
