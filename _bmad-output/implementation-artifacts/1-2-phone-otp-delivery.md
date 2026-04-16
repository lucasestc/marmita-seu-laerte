---
story_key: "1-2-phone-otp-delivery"
epic: 1
story: 1.2
status: review
---

# Story 1.2: Phone Number Entry, LGPD Consent & OTP Delivery

## Story

As a new customer,
I want to enter my phone number and agree to WhatsApp notifications, then receive a one-time access code via WhatsApp,
So that I can begin the sign-up process securely without needing a password.

## Acceptance Criteria

**AC1:** Given an unauthenticated visitor navigates to `/login` — the page loads a form with: phone number input (E.164-normalized on submit), LGPD consent checkbox with WhatsApp opt-in text, a link to `/privacidade`, and a "Receber código" button. The page is marked `noindex`.

**AC2:** Given a valid Brazilian mobile number + checked consent — Server Action creates an `otp_codes` row (`phone` E.164, `code_hash` bcrypt, `expires_at` 10 min from now), sends "Seu código de acesso: XXXXXX. Válido por 10 minutos." via WhatsApp, transitions UI to OTP screen. Raw code never stored or logged.

**AC3:** Given form submitted without consent — shows "Você precisa aceitar receber mensagens no WhatsApp para continuar." No OTP sent.

**AC4:** Given Z-API call fails — returns `{ success: false, error: 'Não foi possível enviar o código. Tente novamente.' }`. Error logged server-side. Customer sees Portuguese error.

**AC5:** Given `/privacidade` route — a privacy policy page renders with LGPD-compliant content (data collected, how used, how to request deletion).

## Tasks / Subtasks

- [x] **Task 1: Apply brand theme and typography**
  - [x] Update `src/app/globals.css` — terracotta primary, warm off-white background, amber accent CSS vars
  - [x] Update `src/app/layout.tsx` — switch to Plus Jakarta Sans, set `lang="pt-BR"`, update metadata

- [x] **Task 2: Add createServiceClient() Supabase helper**
  - [x] Add `createServiceClient()` to `src/lib/supabase/server.ts` using `createClient` from `@supabase/supabase-js` with service role key (bypasses RLS for pre-auth OTP insert)

- [x] **Task 3: Create requestOtp Server Action**
  - [x] Create `src/actions/auth.ts` with `requestOtp(phone, consent): Promise<ActionResult<{ phone: string }>>`
  - [x] Zod schema: normalize phone to E.164, validate consent is `true`
  - [x] Generate 6-digit code, bcrypt hash, insert into `otp_codes`
  - [x] Call `sendMessage()` with Portuguese OTP message
  - [x] Return success with normalized phone, or typed error messages

- [x] **Task 4: Create LoginFlow client component**
  - [x] Create `src/components/features/LoginFlow.tsx` managing `phone` | `otp` step state
  - [x] Phone step: React Hook Form + Zod, phone input ("Seu WhatsApp"), consent checkbox, "Receber código" button
  - [x] On success: store normalized phone, transition to OTP step placeholder
  - [x] OTP step placeholder: show "Código enviado para {phone}" with resend link (calls requestOtp again)
  - [x] Display field errors and root errors in Portuguese

- [x] **Task 5: Create login page**
  - [x] Create `src/app/(auth)/login/page.tsx` — server component, `robots: noindex`, renders `LoginFlow`

- [x] **Task 6: Create privacy policy page**
  - [x] Create `src/app/privacidade/page.tsx` — LGPD-compliant content, publicly accessible

- [x] **Task 7: TypeScript compilation check**
  - [x] Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Technical Context

**Stack:** Next.js 16.2.3 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui (base-nova style, @base-ui/react primitives), Zod, React Hook Form

**Installed packages (added in this story):** `zod`, `react-hook-form`, `@hookform/resolvers`, shadcn components: `button`, `input`, `label`, `checkbox`

**Brand theme (from UX design spec):**
- Primary: terracotta `#7C3D12` → `oklch(0.42 0.11 48)`
- Accent: amber `#D97706` → `oklch(0.65 0.17 55)`
- Background: warm off-white `#FAF7F2` → `oklch(0.977 0.006 72)`
- Typography: Plus Jakarta Sans (Google Fonts)

**Supabase client pattern:**
- `createServerClient()` (from `@supabase/ssr`) — for authenticated user operations
- `createServiceClient()` (from `@supabase/supabase-js`) — for pre-auth server operations (OTP insert); bypasses RLS

**Phone normalization (E.164):**
- Strip non-digits → if starts with `55` keep, else prepend `55` → prepend `+`
- Valid result: `+5511999999999` (11 digits after country code)
- Regex: `/^\+55\d{10,11}$/`

**Server Action pattern:**
```typescript
'use server'
// Returns ActionResult<T> — never throws to client
// All user-facing strings in Portuguese
// Log server errors with [context] prefix
```

**React Hook Form + Checkbox (Base UI):**
- Use `Controller` for `@base-ui/react/checkbox` since it uses `onCheckedChange(checked: boolean)` not native `onChange`
- Phone input: spread `{...field}` from `register()` — InputPrimitive accepts standard HTML props

**Story 1.3 dependency:**
- The OTP step rendered by LoginFlow in this story is a placeholder
- Story 1.3 will add: `OtpInput` custom component (6-box auto-advance), `verifyOtp` Server Action, full verification + session creation

**No tests in MVP:** per architecture, Vitest is post-MVP. Validation = `tsc --noEmit` + manual flow check.

## Dev Agent Record

### Implementation Plan

1. Theme + font → global impact, do first so all subsequent UI picks up correct styles
2. Supabase service client → needed by the Server Action
3. Server Action → pure backend, no UI dependency
4. LoginFlow component → depends on Server Action import
5. Login page → thin wrapper around LoginFlow
6. Privacy page → standalone, no dependencies
7. tsc check → final validation

### Debug Log

- **Zod v4 breaking changes:** `errorMap` → `message`; `ZodError.errors` → `ZodError.issues`. Updated both `auth.ts` and `LoginFlow.tsx`.
- **Zod literal type vs form default values:** `z.literal(true)` makes the input type `true`, breaking `useForm({ defaultValues: { consent: false } })`. Resolved by using `z.boolean()` for the client schema + a manual guard in `onSubmit`. Server action uses `z.literal(true)` for authoritative validation.
- **shadcn base-nova style:** Uses `@base-ui/react` primitives, not `@radix-ui`. Checkbox `onCheckedChange` receives `unknown` — cast to `boolean` at call site.
- **new deps installed:** `zod@4.3.6`, `react-hook-form`, `@hookform/resolvers`, `shadcn@4.2.0` (components: button, input, label, checkbox).

### Completion Notes

- Applied brand theme: terracotta primary `oklch(0.42 0.11 48)`, warm off-white background `oklch(0.977 0.006 72)`, amber accent `oklch(0.65 0.17 55)`. Font switched to Plus Jakarta Sans.
- `createServiceClient()` added to `server.ts` using `@supabase/supabase-js` `createClient` with service role key. Used only server-side for pre-auth OTP insert.
- `requestOtp` server action: Zod schema normalizes Brazilian phone → E.164, validates consent is `true`. Generates 6-digit code, bcrypt-hashes it (rounds=10), inserts into `otp_codes` with 10-min expiry. Sends WhatsApp OTP via `sendMessage()`. Raw code never stored or logged.
- `LoginFlow.tsx`: two-state client component (`phone` → `otp`). Phone step uses React Hook Form + `zodResolver`. OTP step is a UI placeholder; Story 1.3 replaces it with `OtpInput` component + `verifyOtp` action.
- Privacy policy page at `/privacidade`: full LGPD-compliant content (data collected, use, retention, rights, contact).
- `npx tsc --noEmit` passes with zero errors.

## File List

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/lib/supabase/server.ts`
- `src/actions/auth.ts`
- `src/components/features/LoginFlow.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/privacidade/page.tsx`

## Change Log

- 2026-04-09: Story created and implemented — all 7 tasks complete, all ACs satisfied, `tsc --noEmit` clean.
