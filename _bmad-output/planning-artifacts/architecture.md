---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md']
workflowType: 'architecture'
project_name: 'Marmita do Seu Laerte'
user_name: 'Lucas'
date: '2026-04-06'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements: 31 FRs across 6 capability areas**
- Authentication & Identity (FR1–4): Custom WhatsApp OTP, 30-day sessions, LGPD consent
- Menu & Discovery (FR5–8): Public SSR menu, capacity display, admin menu management
- Ordering (FR9–14): Order placement, status tracking, pre-payment cancellation, capacity lock at 100, midnight cutoff
- Payment (FR15–18): Pix key generation, 30-min expiry, regeneration
- Notifications & Communication (FR19–24): 6 WhatsApp triggers (customer + Laerte)
- Operations (FR25–27): Nightly email with Excel, admin notification scheduling, order count tracking
- Compliance & Privacy (FR28–31): LGPD consent, privacy policy, deletion request, meal rating

**Non-Functional Requirements (architectural drivers):**
- Concurrent order count integrity (NFR13) — two customers cannot claim the last slot → atomic DB operations required
- Z-API as single point of failure for both auth (OTP) and all notifications → graceful degradation required
- Server-side only for Pix logic and Z-API webhooks (NFR8) → no client-side payment handling
- Idempotent webhook handling (NFR16) → event deduplication needed
- Nightly email within 5 minutes of midnight (NFR15) → reliable scheduled job required

**Scale & Complexity:**
- Primary domain: Full-stack web app
- Complexity level: Low-Medium
- Max throughput: ~100 orders/day (deliberately capped)
- Concurrent users: Very low — Vercel + Supabase free tier sufficient for MVP
- Estimated architectural components: ~8 (auth, menu, ordering, payment, notifications, ops/email, admin, cron)

### Technical Constraints & Dependencies

- Stack locked: Next.js App Router, Supabase (Postgres), Z-API, manual Pix (MVP), Mercado Pago (Phase 2)
- No NextAuth — custom OTP session management against Supabase
- No real-time subscriptions — page-load refresh for capacity counter
- Pix key generation and payment confirmation: server-side Next.js API routes only
- Cron jobs required: midnight order cutoff + nightly email, Sunday menu reveal, daily morning story, 1pm rating prompt

### Payment Confirmation Flow (MVP)

Manual confirmation via WhatsApp bidirectional flow:

1. Customer places order → Pix key shown → order status: `aguardando_pagamento`
2. System sends Laerte a WhatsApp notification (FR24) containing: Order ID (short human-readable), customer name, customer phone, delivery date, amount
3. Customer pays via their bank app
4. Laerte cross-references bank payment with WhatsApp notification, replies `PAGO <order-id>`
5. Z-API inbound webhook fires → server parses command → marks order `confirmado` → sends WhatsApp confirmation to customer

**Constraint:** Order IDs must be short and human-readable (e.g., 4-digit sequential) — Laerte must be able to type them manually. UUIDs are not acceptable for this flow.

### Cross-Cutting Concerns

- **Auth state:** 30-day session cookie touches every authenticated route
- **Per-day order count:** shared state used by ordering (capacity check), nightly email (Laerte's list), and cron (cutoff logic) — must be consistent
- **Phone number:** serves dual purpose — identity (auth) AND notification channel — must never be lost or orphaned
- **Z-API dependency:** single point of failure for both OTP auth and all customer-facing notifications; inbound webhook also handles Laerte's payment confirmations
- **Inbound WhatsApp routing:** system must distinguish Laerte's `PAGO` commands from other incoming messages and route them to the payment confirmation handler

## Starter Template

### Primary Technology Domain

Full-stack Next.js web application with Supabase backend. Stack pre-decided in PRD — starter evaluation confirms `create-next-app` is the correct foundation.

### Starters Considered

| Option | Verdict | Reason |
|---|---|---|
| `create-next-app` | ✅ Selected | Clean foundation; App Router, TypeScript, Tailwind, ESLint — exactly what's needed |
| T3 Stack | ❌ Skipped | Includes tRPC and Prisma — unnecessary complexity; Supabase client used directly |
| Supabase Next.js template | ❌ Skipped | Bundles NextAuth and opinionated auth — conflicts with custom OTP flow |

### Selected Starter: create-next-app@latest

**Initialization Command:**

```bash
npx create-next-app@latest marmita-seu-laerte \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Post-init dependencies:**

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Excel generation (nightly email)
npm install xlsx

# Email sending
npm install resend

# Z-API integration via native fetch — no extra package needed
```

### Architectural Decisions Established by Starter

**Language & Runtime:** TypeScript strict mode, Node.js via Vercel

**Styling:** Tailwind CSS v4 (bundled with Next.js 16.2) — utility-first, mobile-first by default

**Routing:** Next.js App Router — server components for public pages (`/`, `/menu`), client components for interactive flows (`/login`, `/order`, `/checkout`)

**Build Tooling:** Turbopack (default in Next.js 16) — fast dev server, production builds via Vercel

**Code Organization:**
```
src/
  app/           # App Router pages and layouts
  components/    # Shared UI components
  lib/           # Supabase client, Z-API helpers, utilities
  types/         # TypeScript type definitions
```

**Testing:** Not included in starter — add Vitest + Testing Library post-MVP

**Development Experience:** ESLint + Prettier, TypeScript path aliases (`@/*`), hot reload via Turbopack

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data model design (tables, relationships, constraints)
- OTP storage strategy
- Order ID format (Laerte's manual confirmation flow depends on this)
- Route protection via middleware
- Z-API webhook endpoint security

**Important Decisions (Shape Architecture):**
- Server Actions vs Route Handlers split
- Cron job schedule and structure
- Error handling standards

**Deferred Decisions (Post-MVP):**
- Full observability/monitoring stack
- Mercado Pago payment webhook handling
- Testing framework (Vitest + Testing Library)

### Data Architecture

**OTP Code Storage:** Supabase `otp_codes` table
- Fields: `id`, `phone`, `code` (hashed), `expires_at`, `used_at`
- Expiry: 10 minutes from creation, single-use enforced by `used_at` timestamp
- Rationale: No extra infrastructure; Postgres TTL via `expires_at` check is sufficient at this scale

**Order ID Format:** Sequential 4-digit integer (e.g., `#0001`)
- Laerte types `PAGO 0001` via WhatsApp — must be short and humanreadable
- Exposed order volume is not a business concern at this scale
- Implementation: Supabase sequence or auto-increment primary key + zero-padded display

**Data Validation:** Zod — TypeScript-first schema validation on all API Route Handler inputs and Server Action arguments

**Migration Approach:** Supabase migrations via `supabase db push` (SQL migration files in `/supabase/migrations`)

### Authentication & Security

**Session Management:** `@supabase/ssr` — `createServerClient()` in Next.js middleware and server components; `createBrowserClient()` in client components. 30-day cookie expiry configured in Supabase Auth settings.

**Route Protection:** `middleware.ts` at project root — checks Supabase session, redirects unauthenticated requests away from `/order/*`, `/checkout/*`, `/admin/*` to `/login`

**Z-API Webhook Validation:** Secret token in URL query param (`/api/webhooks/zapi?token=WEBHOOK_SECRET`). Token stored in environment variable. Requests without valid token return 401.

**OTP Security:** Codes hashed (bcrypt) before storage. Raw code sent via WhatsApp, never stored in plain text. Verified by hash comparison on submission.

### API & Communication Patterns

**Architecture:** Hybrid — Server Actions for user-facing mutations, Route Handlers for webhooks and cron endpoints

| Layer | Approach | Used For |
|---|---|---|
| Server Actions | Next.js Server Actions | Login (OTP request + verify), place order, cancel order, submit rating |
| Route Handlers | `/api/webhooks/zapi` | Inbound Z-API messages (Laerte's PAGO commands, delivery receipts) |
| Route Handlers | `/api/cron/*` | Cron-triggered jobs (nightly email, notifications, cutoff) |

**Error Response Standard:** All Route Handlers return `{ error: string, code: string }` on failure with appropriate HTTP status codes.

**Z-API Integration:** Thin wrapper at `src/lib/zapi.ts` — `sendMessage(phone: string, text: string)` using native `fetch` against Z-API REST API. Environment variables: `ZAPI_BASE_URL`, `ZAPI_TOKEN`, `ZAPI_INSTANCE_ID`.

**Inbound Message Routing:** Z-API webhook handler parses sender phone number — if sender matches `LAERTE_PHONE` env var and message matches `/^PAGO\s+(\d{4})$/i`, routes to payment confirmation handler. All other messages are ignored (logged only).

### Frontend Architecture

**State Management:** React hooks only — `useState`, `useEffect`, Supabase browser client. No Redux or Zustand; scope does not justify additional state library.

**Forms:** React Hook Form + Zod resolver for OTP input (`/login`) and order flow. Plain controlled inputs acceptable for simpler forms (e.g., rating submission).

**Component Pattern:** Server components fetch data and pass to client components as props. Client components own interactivity only. No client-side data fetching except for real-time-like updates (none needed in MVP).

### Infrastructure & Deployment

**Hosting:** Vercel — native Next.js support, free tier covers MVP, environment variables UI, preview deployments per branch.

**Cron Jobs:** Vercel Cron Jobs (defined in `vercel.json`), calling protected Route Handlers:

| Schedule (UTC-3 / Brasília) | Cron Expression | Job |
|---|---|---|
| Midnight daily | `0 3 * * *` | Order cutoff + nightly email to Laerte |
| 8am weekdays | `0 11 * * 1-5` | Morning dish story notification |
| 1pm weekdays | `0 16 * * 1-5` | Rating prompt notification |
| Sunday 8pm | `0 23 * * 0` | Weekly menu reveal notification |

**Cron Security:** Vercel sets `Authorization: Bearer` header on cron requests; handlers validate `CRON_SECRET` env var.

**Environment Configuration:** Vercel environment variables per environment (development / preview / production). Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZAPI_BASE_URL`, `ZAPI_TOKEN`, `ZAPI_INSTANCE_ID`, `LAERTE_PHONE`, `LAERTE_EMAIL`, `WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`.

**Monitoring:** Vercel Analytics (built-in) + structured `console.error` logs surfaced in Vercel Log Drains. Full observability stack deferred to post-MVP.

### Decision Impact Analysis

**Implementation Sequence:**
1. Project init + Supabase schema + environment setup
2. Auth flow (OTP request → WhatsApp send → verify → session)
3. Menu display (public SSR page)
4. Order flow (place order, capacity check, Pix key generation)
5. Payment confirmation (Laerte WhatsApp command → Z-API webhook)
6. WhatsApp notification system (cron jobs + triggers)
7. Nightly email (cron + Excel generation)
8. Admin menu management

**Cross-Component Dependencies:**
- Auth must be complete before ordering (session required for FR9)
- Order count integrity (NFR13) depends on Supabase row-level locking in order placement
- Nightly email depends on orders table being queryable by delivery date
- Z-API webhook handler depends on inbound message routing logic being in place before payment confirmation works

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Supabase / Postgres):**
- Tables: `snake_case` plural — `orders`, `otp_codes`, `menus`, `menu_items`, `ratings`
- Columns: `snake_case` — `customer_phone`, `delivery_date`, `created_at`
- Foreign keys: `{singular_table}_id` — `customer_id`, `menu_item_id`
- Every table includes: `id` (bigserial PK), `created_at` (timestamptz default now()), `updated_at` (timestamptz)
- Order status values: `aguardando_pagamento` | `confirmado` | `entregue` | `cancelado`

**API Routes:**
- Paths: `kebab-case`, grouped by domain — `/api/webhooks/zapi`, `/api/cron/nightly-email`
- No `/api/v1/` versioning in MVP — add prefix only when breaking changes are introduced

**TypeScript / Code:**
- Components: `PascalCase` filenames and exports — `OrderCard.tsx`, `MenuDay.tsx`
- Pages/layouts: Next.js convention — `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Utilities/helpers: `camelCase` functions in `kebab-case` files — `src/lib/zapi.ts`, `src/lib/supabase/server.ts`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_ORDERS_PER_DAY = 100`
- Types: `PascalCase` with no prefix — `Order`, `OtpCode`, `MenuWithItems`

### Structure Patterns

**Project Organization:**
```
src/
  app/
    (public)/          # Unauthenticated routes: /, /menu, /privacy
    (auth)/            # Auth routes: /login
    (app)/             # Authenticated routes: /order, /checkout
    admin/             # Admin routes: /admin/menu, /admin/orders
    api/
      webhooks/        # Inbound webhooks: /api/webhooks/zapi
      cron/            # Cron endpoints: /api/cron/nightly-email
  components/
    ui/                # Primitive UI components (Button, Input, etc.)
    features/          # Feature-specific components (OrderCard, MenuWeek, etc.)
  lib/
    supabase/
      server.ts        # createServerClient() helper
      browser.ts       # createBrowserClient() helper
    zapi.ts            # sendMessage() + inbound message parser
    email.ts           # sendNightlyEmail() using Resend + xlsx
    cron/              # Job logic: cutoff.ts, nightly-email.ts, notifications.ts
  types/
    database.types.ts  # Auto-generated Supabase types (never edit manually)
    app.types.ts       # Application-level types not tied to DB schema
```

Co-located tests (post-MVP): `*.test.ts` next to source file, not in a separate `__tests__` folder.

### Format Patterns

**Server Action responses:**
```typescript
// Success
return { success: true, data: { orderId: '0001' } }
// Failure — never throw to client
return { success: false, error: 'Capacidade esgotada para este dia.' }
```

**Route Handler responses:**
```typescript
// Success: 200
return NextResponse.json({ data: { ... } })
// Failure: appropriate HTTP status
return NextResponse.json({ error: 'Mensagem legível', code: 'CAPACITY_EXCEEDED' }, { status: 409 })
```

**HTTP status codes:**
- `200` success, `400` validation error, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (capacity full / duplicate), `500` unexpected error

**Date/time:**
- Database: always UTC (`timestamptz`)
- API responses: ISO 8601 strings
- UI display: Brasília timezone (UTC-3) via `Intl.DateTimeFormat` — no date library needed for MVP

**JSON field naming:** `camelCase` in TypeScript/API; `snake_case` in database. Supabase JS client maps automatically.

### Process Patterns

**Error Handling:**
```typescript
try {
  // ...
} catch (err) {
  console.error('[context]', err)
  return { success: false, error: 'Erro inesperado. Tente novamente.' }
}
// Never expose raw error messages to users
// All user-facing strings in Portuguese
```

**Loading States:**
- Server Actions: use React `useTransition` — `const [isPending, startTransition] = useTransition()`
- Disable submit buttons during `isPending` to prevent double-submission
- Show skeleton or spinner during navigation via Next.js `loading.tsx`

**Supabase Client Usage:**
- Server components, Server Actions, Route Handlers: always `createServerClient()` from `src/lib/supabase/server.ts`
- Client components only: `createBrowserClient()` from `src/lib/supabase/browser.ts`
- Never use `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- All customer data reads/writes use RLS; service role key only for admin/cron operations

**Z-API Integration:**
- All outbound messages via `sendMessage(phone, text)` in `src/lib/zapi.ts` — never call Z-API directly from components
- Inbound webhook checks sender is `LAERTE_PHONE` before processing `PAGO` commands
- Phone numbers stored and compared in E.164 format: `+5511999999999`

### Enforcement Guidelines

**All AI agents MUST:**
- Use `snake_case` for database columns, `camelCase` for TypeScript variables
- Return `{ success, error }` from Server Actions — never `throw`
- Use `createServerClient()` in all server-side code
- Store phone numbers in E.164 format
- Use Portuguese for user-facing strings; English for code, comments, and logs
- Validate all external inputs with Zod before processing

**Anti-Patterns:**
- ❌ Calling Z-API directly from components — use `sendMessage()` wrapper
- ❌ Using `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- ❌ Storing phone numbers without E.164 normalization
- ❌ Throwing from Server Actions
- ❌ Hardcoding `100` — always use `MAX_ORDERS_PER_DAY`
- ❌ UUIDs in user-facing order references — use sequential 4-digit ID
