---
story_key: "1-1-project-initialization"
epic: 1
story: 1.1
status: review
---

# Story 1.1: Project Initialization & Infrastructure Setup

## Story

As a developer,
I want the project scaffolded with all required infrastructure and dependencies configured,
So that development can begin on a stable, production-ready foundation with no technical debt from setup.

## Acceptance Criteria

- **AC1:** `npx create-next-app@latest marmita-seu-laerte --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` produces a runnable project; `@supabase/supabase-js`, `@supabase/ssr`, `xlsx`, `resend`, and `bcryptjs` + `@types/bcryptjs` are installed as dependencies.
- **AC2:** `src/app/`, `src/components/ui/`, `src/components/features/`, `src/lib/supabase/`, `src/lib/`, and `src/types/` directories exist.
- **AC3:** `supabase/migrations/` contains an initial migration creating the `customers` table and `otp_codes` table with all required columns.
- **AC4:** `.env.local.example` documents every required env var with a description. No var is hardcoded in source files.
- **AC5:** `src/lib/supabase/server.ts` exports `createServerClient()` and `src/lib/supabase/browser.ts` exports `createBrowserClient()`.
- **AC6:** `src/lib/zapi.ts` exports `sendMessage(phone: string, text: string): Promise<void>` using native `fetch`.
- **AC7:** `src/types/app.types.ts` exports core application types: `Order`, `OtpCode`, `Customer`.
- **AC8:** `middleware.ts` at project root protects `/order/*`, `/checkout/*`, `/admin/*` — unauthenticated requests redirect to `/login`.
- **AC9:** TypeScript compilation (`npx tsc --noEmit`) passes with zero errors.

## Tasks / Subtasks

- [x] **Task 1: Scaffold Next.js project and install dependencies**
  - [x] Run `create-next-app@latest` with required flags in `/workspaces/codespaces-blank`
  - [x] Install `@supabase/supabase-js @supabase/ssr xlsx resend bcryptjs @types/bcryptjs`
  - [x] Verify `package.json` contains all dependencies

- [x] **Task 2: Create required directory structure**
  - [x] Create `src/components/ui/` directory
  - [x] Create `src/components/features/` directory
  - [x] Create `src/lib/supabase/` directory
  - [x] Create `src/types/` directory

- [x] **Task 3: Create Supabase migration for customers and otp_codes tables**
  - [x] Create `supabase/migrations/` directory
  - [x] Write initial migration SQL file creating `customers` and `otp_codes` tables

- [x] **Task 4: Create `.env.local.example` with all required vars**
  - [x] Document all 11 required environment variables with descriptions

- [x] **Task 5: Create Supabase client helpers**
  - [x] Write `src/lib/supabase/server.ts` exporting `createServerClient()`
  - [x] Write `src/lib/supabase/browser.ts` exporting `createBrowserClient()`

- [x] **Task 6: Create Z-API helper**
  - [x] Write `src/lib/zapi.ts` exporting `sendMessage(phone, text)`

- [x] **Task 7: Create core TypeScript types**
  - [x] Write `src/types/app.types.ts` with `Order`, `OtpCode`, `Customer` types

- [x] **Task 8: Create auth middleware**
  - [x] Write `middleware.ts` protecting `/order/*`, `/checkout/*`, `/admin/*`

- [x] **Task 9: Verify TypeScript compilation**
  - [x] Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Technical Context (from Architecture)

**Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, Supabase, Z-API, native fetch

**Init command:**
```bash
npx create-next-app@latest marmita-seu-laerte \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Additional deps:**
```bash
npm install @supabase/supabase-js @supabase/ssr xlsx resend bcryptjs
npm install --save-dev @types/bcryptjs
```

**Note:** bcryptjs added (Story 1.2 needs it for OTP hashing — better to install now in the foundation story).

**DB Schema (customers):**
```sql
id          bigserial PRIMARY KEY
phone       text UNIQUE NOT NULL  -- E.164 format: +5511999999999
name        text
whatsapp_consent boolean DEFAULT false
created_at  timestamptz DEFAULT now()
updated_at  timestamptz
```

**DB Schema (otp_codes):**
```sql
id          bigserial PRIMARY KEY
phone       text NOT NULL
code_hash   text NOT NULL       -- bcrypt hash of 6-digit code
expires_at  timestamptz NOT NULL -- 10 minutes from creation
used_at     timestamptz          -- set on first use; NULL = unused
created_at  timestamptz DEFAULT now()
```

**Supabase client pattern (from @supabase/ssr docs):**
- `server.ts` → `createServerClient` from `@supabase/ssr`, requires cookie store from `next/headers`
- `browser.ts` → `createBrowserClient` from `@supabase/ssr`

**Z-API base URL pattern:**
```
https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/send-text
```

**Middleware:** Use `@supabase/ssr` `createServerClient` in middleware to check session. Redirect unauthenticated users to `/login?return={pathname}`.

**Testing:** Vitest is post-MVP. Story 1.1 validation = TypeScript compilation + directory/file existence assertions.

**Project location:** Create in `/workspaces/codespaces-blank/marmita-seu-laerte/`

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only)
- `ZAPI_BASE_URL` — Z-API base URL
- `ZAPI_TOKEN` — Z-API instance token
- `ZAPI_INSTANCE_ID` — Z-API instance ID
- `LAERTE_PHONE` — Laerte's phone in E.164 (e.g. +5511999999999)
- `LAERTE_EMAIL` — Laerte's email for nightly report
- `WEBHOOK_SECRET` — Secret token for Z-API webhook URL validation
- `CRON_SECRET` — Secret for Vercel cron Authorization header
- `RESEND_API_KEY` — Resend API key for nightly email

## Dev Agent Record

### Implementation Plan

Create Next.js project in `/workspaces/codespaces-blank/marmita-seu-laerte/`, install all deps, scaffold directories, write migration, helpers, types, middleware. Validate with `tsc --noEmit`.

### Debug Log

- `xlsx` has known high-severity vulnerabilities (Prototype Pollution, ReDoS). Used server-side only for nightly Excel generation with controlled input — acceptable risk for MVP. Logged for post-MVP review.

### Completion Notes

- Created Next.js 16.2.3 project at `/workspaces/codespaces-blank/marmita-seu-laerte/` with TypeScript, Tailwind, ESLint, App Router, src-dir, `@/*` alias.
- Installed all required deps: `@supabase/supabase-js`, `@supabase/ssr`, `xlsx`, `resend`, `bcryptjs`, `@types/bcryptjs`.
- Directory structure matches architecture spec exactly.
- Initial SQL migration creates `customers` and `otp_codes` tables with correct columns, constraints, and indexes.
- `.env.local.example` documents all 11 required env vars with descriptions.
- Supabase server/browser helpers use `@supabase/ssr` pattern with cookie store from `next/headers`.
- `sendMessage()` in `zapi.ts` uses native `fetch` with `Client-Token` header against `{ZAPI_BASE_URL}/send-text`.
- `app.types.ts` exports `Customer`, `OtpCode`, `Order`, `OrderStatus`, `ActionResult<T>` — `ActionResult` added proactively as it's required by every Server Action in Stories 1.2–1.3.
- `middleware.ts` protects `/order/*`, `/checkout/*`, `/admin/*`; preserves return URL; redirects authenticated users away from `/login`.
- `npx tsc --noEmit` passes with zero errors.

## File List

- `marmita-seu-laerte/package.json`
- `marmita-seu-laerte/middleware.ts`
- `marmita-seu-laerte/.env.local.example`
- `marmita-seu-laerte/supabase/migrations/20260408000000_initial_schema.sql`
- `marmita-seu-laerte/src/lib/supabase/server.ts`
- `marmita-seu-laerte/src/lib/supabase/browser.ts`
- `marmita-seu-laerte/src/lib/zapi.ts`
- `marmita-seu-laerte/src/types/app.types.ts`

## Change Log

- 2026-04-08: Story created and implemented — all 9 tasks complete, all ACs satisfied, `tsc --noEmit` clean.
