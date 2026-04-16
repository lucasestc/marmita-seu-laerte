---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# Marmita do Seu Laerte - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Marmita do Seu Laerte, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Customer can authenticate using their phone number and a one-time code delivered via WhatsApp
FR2: Customer can request a new one-time code if the first one does not arrive
FR3: Authenticated customer sessions persist for 30 days without requiring re-authentication
FR4: Customer can provide explicit consent to receive WhatsApp notifications during signup
FR5: Any visitor can view the current week's menu with dish names, descriptions, and per-day availability
FR6: Any visitor can see which days have reached maximum capacity
FR7: Admin can create and update the weekly menu for any week
FR8: The menu page is publicly accessible without authentication and indexable by search engines
FR9: Authenticated customer can place an order for any available day
FR10: Customer can view the current status of their order
FR11: Customer can cancel an order that has not yet been paid; the day's available slot is restored
FR12: Customer cannot cancel an order after payment has been confirmed
FR13: System prevents new orders for a day once 100 confirmed orders have been placed
FR14: System stops accepting new orders for a given day at midnight of the preceding day
FR15: Customer can initiate Pix payment for a pending order
FR16: Customer can view the Pix key for their pending payment
FR17: System expires a Pix key after 30 minutes if payment has not been confirmed
FR18: Customer can request a new Pix key for an order with an expired payment window
FR19: Customer receives a WhatsApp confirmation when their order payment is confirmed
FR20: Customer receives a WhatsApp message each Sunday with the upcoming week's full menu
FR21: Customer receives a WhatsApp message each delivery morning with the dish story for that day
FR22: Customer receives a WhatsApp prompt at 1pm on each delivery day to rate their meal
FR23: Customer receives a WhatsApp confirmation when they cancel an order before payment
FR24: Laerte receives a WhatsApp alert each time a new order is placed
FR25: System sends Laerte an automated email each midnight with an Excel attachment listing next-day orders (customer name, phone number, order details)
FR26: Admin can compose and schedule the weekly menu reveal message and daily dish story notifications
FR27: System tracks confirmed order count per day and makes it accessible to admin
FR28: Customer must provide explicit WhatsApp notification consent before completing signup
FR29: A privacy policy page is accessible from the signup flow
FR30: Customer can submit a request for deletion of their personal data
FR31: Customer can submit a meal rating after receiving the 1pm prompt (rating stored; aggregate display is Phase 2)

### NonFunctional Requirements

NFR1: Public menu page achieves LCP < 2.5s on a 3G mobile connection
NFR2: Order flow interactions (button taps, form submissions) respond within 300ms
NFR3: Pix key generation completes within 5 seconds of order placement
NFR4: WhatsApp OTP message delivered within 60 seconds of request
NFR5: All data in transit encrypted via HTTPS/TLS
NFR6: All data at rest in Supabase encrypted (Supabase default)
NFR7: OTP codes expire after 10 minutes and are single-use
NFR8: Pix key generation and payment confirmation handled server-side only — no payment logic in the browser
NFR9: Phone numbers and personal data stored only in Supabase; never logged in plain text
NFR10: OTP delivery failure triggers automatic retry; customer is informed if delivery fails after retry
NFR11: Nightly email failure triggers a fallback alert to Lucas
NFR12: Failed Pix confirmation webhooks are logged and surfaced to admin for manual resolution
NFR13: System maintains order count integrity under concurrent requests — two customers cannot claim the last slot simultaneously
NFR14: Z-API connection failures degrade gracefully — customer-facing operations show a clear error, not a crash
NFR15: Nightly email generation and send completes within 5 minutes of midnight cutoff
NFR16: Z-API webhook events are idempotent — duplicate delivery does not create duplicate orders or notifications
NFR17: All customer-facing screens meet WCAG 2.1 AA contrast ratios; sufficient for outdoor/bright-screen reading
NFR18: Interactive elements (OTP input, order buttons, Pix copy) meet minimum 44x44px touch target size
NFR19: Error messages on critical flows (OTP, payment) are text-based and not reliant solely on color

### Additional Requirements

- **Project initialization:** `create-next-app@latest` with TypeScript, Tailwind, ESLint, App Router, src-dir, `@/*` import alias. Post-init: `@supabase/supabase-js @supabase/ssr`, `xlsx`, `resend`.
- **Supabase schema setup:** Tables: `otp_codes`, `customers`, `orders`, `menu_weeks`, `menu_items`, `ratings`. Every table includes `id` (bigserial PK), `created_at`, `updated_at`. Migrations via `supabase db push`.
- **Order ID format:** Sequential 4-digit integer (e.g., `#0001`) — zero-padded display. Required for Laerte's `PAGO 0001` WhatsApp confirmation flow.
- **Auth middleware:** `middleware.ts` protects `/order/*`, `/checkout/*`, `/admin/*` — unauthenticated requests redirect to `/login`.
- **Z-API webhook security:** Secret token in URL query param (`/api/webhooks/zapi?token=WEBHOOK_SECRET`); requests without valid token return 401.
- **OTP security:** Codes hashed (bcrypt) before storage; raw code sent via WhatsApp only, never stored in plain text.
- **Inbound WhatsApp routing:** Webhook handler checks sender matches `LAERTE_PHONE` env var and message matches `/^PAGO\s+(\d{4})$/i` before processing payment confirmations. All other inbound messages are logged only.
- **Vercel Cron Jobs** (defined in `vercel.json`):
  - `0 3 * * *` (midnight Brasília) — order cutoff + nightly email
  - `0 11 * * 1-5` (8am weekdays) — morning dish story notification
  - `0 16 * * 1-5` (1pm weekdays) — rating prompt notification
  - `0 23 * * 0` (Sunday 8pm) — weekly menu reveal notification
- **Cron security:** Vercel `Authorization: Bearer` header validated against `CRON_SECRET` env var.
- **Environment variables required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZAPI_BASE_URL`, `ZAPI_TOKEN`, `ZAPI_INSTANCE_ID`, `LAERTE_PHONE`, `LAERTE_EMAIL`, `WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`.
- **Idempotent webhook handling:** Deduplication required on Z-API inbound events (NFR16).
- **Atomic order count:** Supabase row-level locking on order placement to prevent overselling (NFR13).
- **Server Actions pattern:** All user mutations (OTP request/verify, place order, cancel, rate) use Next.js Server Actions returning `{ success, error }`. Never throw to client.
- **Route Handlers only for:** webhooks (`/api/webhooks/zapi`) and cron endpoints (`/api/cron/*`).
- **Phone numbers:** Stored and compared in E.164 format (`+5511999999999`).
- **User-facing strings:** Portuguese only. Code, comments, logs in English.

### UX Design Requirements

No UX design document exists for this project. UI implementation will follow mobile-first principles from PRD:
- Mobile Safari (iOS) and Mobile Chrome (Android) are primary targets
- Single-column on mobile, max-width container on desktop
- Pix key display with tap-to-copy on mobile
- Public pages (landing, menu): SSR/SSG, meta tags, Open Graph for WhatsApp link previews
- Auth and order flow pages: `noindex`
- WCAG 2.1 AA contrast ratios throughout (NFR17)
- 44x44px minimum touch targets on interactive elements (NFR18)

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | WhatsApp OTP authentication |
| FR2 | Epic 1 | OTP resend |
| FR3 | Epic 1 | 30-day session persistence |
| FR4 | Epic 1 | WhatsApp notification consent at signup |
| FR5 | Epic 2 | Public weekly menu display |
| FR6 | Epic 2 | Per-day capacity display / "esgotado" state |
| FR7 | Epic 2 | Admin menu creation and updates |
| FR8 | Epic 2 | Public menu page, SEO-indexable |
| FR9 | Epic 3 | Place order for available day |
| FR10 | Epic 3 | View order status |
| FR11 | Epic 3 | Cancel unpaid order (slot restored) |
| FR12 | Epic 3 | Post-payment cancellation locked |
| FR13 | Epic 3 | Capacity lock at 100 orders/day (atomic) |
| FR14 | Epic 3 | Midnight order cutoff |
| FR15 | Epic 3 | Initiate Pix payment |
| FR16 | Epic 3 | View Pix key |
| FR17 | Epic 3 | Pix key expires after 30 minutes |
| FR18 | Epic 3 | Regenerate expired Pix key |
| FR19 | Epic 4 | Customer WhatsApp order confirmation |
| FR20 | Epic 4 | Sunday WhatsApp menu reveal |
| FR21 | Epic 4 | Morning dish story notification |
| FR22 | Epic 4 | 1pm rating prompt via WhatsApp |
| FR23 | Epic 4 | Cancellation confirmation via WhatsApp |
| FR24 | Epic 4 | Laerte new-order alert via WhatsApp |
| FR25 | Epic 4 | Nightly email to Laerte with Excel order list |
| FR26 | Epic 4 | Admin: schedule notification content |
| FR27 | Epic 4 | Admin: per-day order count tracking |
| FR28 | Epic 1 | LGPD consent at signup |
| FR29 | Epic 1 | Privacy policy page accessible from signup |
| FR30 | Epic 5 | Customer data deletion request |
| FR31 | Epic 5 | Meal rating submission |

## Epic List

### Epic 1: Foundation & Customer Authentication
Customers can register and sign in using their phone number via WhatsApp OTP, with LGPD consent and access to the privacy policy. The full technical foundation (project init, DB schema, auth middleware, environment setup) is in place.
**FRs covered:** FR1, FR2, FR3, FR4, FR28, FR29

### Epic 2: Public Menu & Discovery
Any visitor can view the current week's menu with dish names, descriptions, and per-day availability (including "esgotado" days). Laerte can create and update menu content from the admin panel. The menu page is publicly indexable by search engines.
**FRs covered:** FR5, FR6, FR7, FR8

### Epic 3: Order Placement & Pix Payment
Authenticated customers can place orders for available days, view order status, cancel unpaid orders (slot restored), and complete payment via Pix — including handling expired payment windows and regenerating Pix keys. Capacity is enforced atomically at 100 orders/day with midnight cutoff.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18

### Epic 4: Notifications, Operations & Laerte's Tools
Customers receive the full WhatsApp communication lifecycle (order confirmation, Sunday menu reveal, morning dish story, 1pm rating prompt, cancellation confirmation). Laerte receives a new-order alert on every placement and a nightly email with an Excel attachment listing next-day orders — enabling zero-waste production planning. Admin can schedule notification content and view per-day order counts.
**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27

### Epic 5: Compliance & Ratings
Customers can submit meal ratings and data deletion requests. The platform meets its LGPD obligations.
**FRs covered:** FR30, FR31

---

## Epic 1: Foundation & Customer Authentication

The platform is initialized with its full technical foundation, and customers can register and sign in using their phone number via WhatsApp OTP, with LGPD consent and access to the privacy policy.

### Story 1.1: Project Initialization & Infrastructure Setup

As a developer,
I want the project scaffolded with all required infrastructure and dependencies configured,
So that development can begin on a stable, production-ready foundation with no technical debt from setup.

**Acceptance Criteria:**

**Given** a fresh environment with Node.js and Supabase CLI available
**When** the developer follows the setup instructions
**Then** `npx create-next-app@latest marmita-seu-laerte --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` produces a running dev server
**And** `@supabase/supabase-js`, `@supabase/ssr`, `xlsx`, and `resend` are installed as dependencies

**Given** the project directory
**When** the developer reviews the folder structure
**Then** `src/app/`, `src/components/ui/`, `src/components/features/`, `src/lib/supabase/`, `src/lib/`, and `src/types/` directories exist as specified in the architecture

**Given** the Supabase project is created
**When** `supabase/migrations/` is reviewed
**Then** an initial migration exists creating the `customers` table (`id` bigserial PK, `phone` text unique not null in E.164 format, `name` text, `whatsapp_consent` boolean default false, `created_at` timestamptz default now(), `updated_at` timestamptz) and the `otp_codes` table (`id` bigserial PK, `phone` text not null, `code_hash` text not null, `expires_at` timestamptz not null, `used_at` timestamptz, `created_at` timestamptz default now())

**Given** the environment is configured
**When** all required env vars are present (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZAPI_BASE_URL`, `ZAPI_TOKEN`, `ZAPI_INSTANCE_ID`, `LAERTE_PHONE`, `LAERTE_EMAIL`, `WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`)
**Then** `.env.local.example` documents every required variable with a description
**And** no variable is hardcoded in source files

**Given** the project structure
**When** `src/lib/supabase/server.ts` and `src/lib/supabase/browser.ts` are reviewed
**Then** `createServerClient()` and `createBrowserClient()` helpers are exported from their respective files
**And** `src/lib/zapi.ts` exports a `sendMessage(phone: string, text: string): Promise<void>` function using native `fetch` against the Z-API REST API

---

### Story 1.2: Phone Number Entry, LGPD Consent & OTP Delivery

As a new customer,
I want to enter my phone number and agree to WhatsApp notifications, then receive a one-time access code via WhatsApp,
So that I can begin the sign-up process securely without needing a password.

**Acceptance Criteria:**

**Given** an unauthenticated visitor navigates to `/login`
**When** the page loads
**Then** a form displays with: a phone number input (Brazilian format, E.164 normalized on submit), a LGPD consent checkbox with text explaining WhatsApp notification opt-in, a link to `/privacidade`, and a "Receber código" button
**And** the page is marked `noindex`

**Given** the user enters a valid Brazilian mobile number and checks the consent checkbox
**When** they tap "Receber código"
**Then** a Server Action creates an `otp_codes` row with `phone` (E.164), `code_hash` (bcrypt of a 6-digit code), `expires_at` (10 minutes from now)
**And** `sendMessage()` sends the code to the customer's WhatsApp: "Seu código de acesso: XXXXXX. Válido por 10 minutos."
**And** the UI transitions to the OTP input screen
**And** the raw code is never stored or logged

**Given** the user submits the form without checking the consent checkbox
**When** they tap "Receber código"
**Then** the form shows a Portuguese validation error: "Você precisa aceitar receber mensagens no WhatsApp para continuar."
**And** no OTP is sent

**Given** the Z-API call fails (connection error or non-2xx response)
**When** the Server Action catches the error
**Then** it returns `{ success: false, error: 'Não foi possível enviar o código. Tente novamente.' }`
**And** the error is logged server-side with context
**And** the customer sees the Portuguese error message

**Given** the `/privacidade` route
**When** any visitor navigates to it
**Then** a privacy policy page renders with LGPD-compliant content describing what data is collected, how it is used, and how to request deletion

---

### Story 1.3: OTP Verification, Session Creation & Route Protection

As a customer who received an OTP via WhatsApp,
I want to enter my code and be logged in for 30 days,
So that I can access the ordering flow without re-authenticating each visit.

**Acceptance Criteria:**

**Given** the OTP input screen is displayed
**When** the customer enters the correct 6-digit code within 10 minutes
**Then** a Server Action queries `otp_codes` for an unused, non-expired row matching the phone
**And** bcrypt comparison confirms the code matches
**And** `used_at` is set on the `otp_codes` row (code is now single-use)
**And** a customer row is upserted in `customers` (`whatsapp_consent = true` on first use)
**And** a Supabase session cookie is set with 30-day expiry
**And** the user is redirected to `/` (or the originally requested URL)

**Given** the customer enters an incorrect code
**When** they submit
**Then** the Server Action returns `{ success: false, error: 'Código inválido. Verifique e tente novamente.' }`
**And** the `otp_codes` row is NOT marked used

**Given** the customer's OTP has expired (> 10 minutes old)
**When** they submit any code
**Then** the Server Action returns `{ success: false, error: 'Código expirado. Solicite um novo código.' }`
**And** a "Reenviar código" button is visible on the OTP screen

**Given** the customer taps "Reenviar código"
**When** the Server Action processes the resend
**Then** a new `otp_codes` row is created with a new code and new 10-minute expiry
**And** the new code is sent to the customer's WhatsApp

**Given** a valid Supabase session cookie is present
**When** the customer visits `/login`
**Then** `middleware.ts` redirects them to `/`

**Given** an unauthenticated request to any route under `/order/*`, `/checkout/*`, or `/admin/*`
**When** `middleware.ts` evaluates the request
**Then** the request is redirected to `/login`
**And** the originally requested URL is preserved for post-login redirect

---

## Epic 2: Public Menu & Discovery

Any visitor can view the current week's menu with dish names, descriptions, and per-day availability (including "esgotado" days). Laerte can create and update menu content from the admin panel. The menu page is publicly indexable by search engines.

### Story 2.1: Public Weekly Menu Page

As a visitor,
I want to view this week's full menu with dish details and per-day availability,
So that I can discover what Seu Laerte is cooking and decide when to order.

**Acceptance Criteria:**

**Given** a Supabase migration has been applied
**When** the migration is reviewed
**Then** a `menu_weeks` table exists (`id` bigserial PK, `week_start` date unique not null, `created_at`, `updated_at`) and a `menu_items` table exists (`id` bigserial PK, `menu_week_id` bigint FK → `menu_weeks.id`, `delivery_date` date not null, `name` text not null, `description` text, `created_at`, `updated_at`)

**Given** the current week has menu items in the database
**When** any visitor (authenticated or not) navigates to `/menu` or `/`
**Then** the page renders server-side (SSR) showing each weekday's dish: name, description, and available slot count (e.g., "32 vagas restantes")
**And** days with 100 confirmed orders display "Esgotado" instead of a slot count
**And** the page loads with LCP < 2.5s on a simulated 3G connection

**Given** no menu exists for the current week
**When** any visitor navigates to `/menu`
**Then** a friendly Portuguese message is displayed: "O cardápio desta semana ainda não foi publicado. Volte em breve!"

**Given** the menu page
**When** the HTML `<head>` is inspected
**Then** it contains a `<title>` tag, a `<meta name="description">` tag, and Open Graph tags (`og:title`, `og:description`, `og:image`) suitable for WhatsApp link previews
**And** the page is NOT marked `noindex` (it is publicly indexable)

**Given** a mobile viewport (375px wide)
**When** the menu page is rendered
**Then** the layout is single-column, dish cards are full-width, and all interactive elements meet 44×44px touch targets

---

### Story 2.2: Admin Menu Management

As Laerte (admin),
I want to create and update the weekly menu from an admin panel,
So that customers always see accurate dish information for the coming week.

**Acceptance Criteria:**

**Given** an authenticated request to any `/admin/*` route from a non-admin user
**When** `middleware.ts` evaluates the request
**Then** it redirects to `/` (admin access is restricted to `LAERTE_PHONE` or a configured admin identifier)

**Given** Laerte navigates to `/admin/menu`
**When** the page loads
**Then** he sees a list of weeks with a "Nova semana" button and the ability to edit existing weeks

**Given** Laerte clicks "Nova semana" and selects a week start date
**When** he fills in dish name and description for each weekday and submits
**Then** a Server Action inserts one `menu_weeks` row and up to 5 `menu_items` rows (one per delivery day)
**And** the `/menu` page immediately reflects the new content on next load

**Given** Laerte edits an existing menu item (updates name or description)
**When** he submits the form
**Then** the Server Action updates the corresponding `menu_items` row
**And** the change is reflected on the public menu page on next load

**Given** Laerte submits a menu item with an empty dish name
**When** the Server Action validates with Zod
**Then** it returns `{ success: false, error: 'O nome do prato é obrigatório.' }`
**And** no database write occurs

---

## Epic 3: Order Placement & Pix Payment

Authenticated customers can place orders for available days, view order status, cancel unpaid orders (slot restored), and complete payment via Pix — including handling expired payment windows and regenerating Pix keys. Capacity is enforced atomically at 100 orders/day with midnight cutoff.

### Story 3.1: Order Placement with Capacity & Cutoff Enforcement

As an authenticated customer,
I want to place an order for an available day,
So that I can secure my marmita before capacity runs out.

**Acceptance Criteria:**

**Given** a Supabase migration has been applied
**When** the migration is reviewed
**Then** an `orders` table exists with: `id` bigserial PK, `display_id` text unique not null (zero-padded 4-digit, e.g. `0001`), `customer_id` bigint FK → `customers.id`, `menu_item_id` bigint FK → `menu_items.id`, `delivery_date` date not null, `status` text not null default `aguardando_pagamento` (values: `aguardando_pagamento` | `confirmado` | `entregue` | `cancelado`), `pix_key` text, `pix_expires_at` timestamptz, `created_at`, `updated_at`

**Given** an authenticated customer navigates to `/order`
**When** the page loads
**Then** the current week's menu is displayed with a "Fazer pedido" button for each available day
**And** days at 100 confirmed orders show "Esgotado" with no order button
**And** days past their midnight cutoff (delivery date = today or earlier) show no order button

**Given** the customer taps "Fazer pedido" for an available day
**When** the Server Action processes the order
**Then** it runs an atomic check: `SELECT COUNT(*) FROM orders WHERE delivery_date = $date AND status != 'cancelado'` within a transaction with row-level locking
**And** if count < 100, inserts a new `orders` row with status `aguardando_pagamento` and a generated `display_id`
**And** returns `{ success: true, data: { orderId: '0023' } }` and redirects to `/checkout/[orderId]`

**Given** the atomic check finds exactly 100 existing orders
**When** the Server Action runs
**Then** it returns `{ success: false, error: 'Esgotado para este dia. Escolha outro dia.' }`
**And** no order row is inserted

**Given** the customer attempts to order for a day whose delivery date has already passed midnight
**When** the Server Action validates the delivery date
**Then** it returns `{ success: false, error: 'As reservas para este dia estão encerradas.' }`
**And** no order row is inserted

**Given** two customers simultaneously attempt to place the 100th order for the same day
**When** both Server Actions run concurrently
**Then** only one succeeds; the other receives the "Esgotado" error
**And** exactly 100 orders exist for that day (no overselling)

---

### Story 3.2: Pix Payment Key Display & Order Status View

As a customer who has placed an order,
I want to see my Pix payment key and current order status,
So that I can complete payment and know what's happening with my order.

**Acceptance Criteria:**

**Given** the customer is redirected to `/checkout/[orderId]` after placing an order
**When** the page loads
**Then** it displays: order summary (dish name, delivery date, display ID e.g. `#0023`), Pix key (static key from env var `PIX_KEY` in MVP), amount (R$35,00 or configured price), a 30-minute countdown timer, and a "Copiar chave Pix" button
**And** tapping "Copiar chave Pix" copies the key to clipboard (tap-to-copy on mobile)
**And** the page is marked `noindex`

**Given** the customer navigates to `/order/status` or their order history
**When** the page loads
**Then** they see their most recent order with: display ID, delivery date, dish name, and current status in Portuguese (`Aguardando pagamento` | `Confirmado` | `Entregue` | `Cancelado`)

**Given** the order has status `aguardando_pagamento`
**When** the checkout page renders
**Then** the Pix key and countdown are visible
**And** the `pix_expires_at` is set to 30 minutes after order creation if not already set

**Given** the order has status `confirmado`
**When** the customer visits `/checkout/[orderId]`
**Then** the page shows a confirmation message: "Pedido confirmado! Nos vemos na quinta às 11h45 no lobby. 🍱"
**And** no Pix key or countdown is displayed

---

### Story 3.3: Pix Key Expiry & Regeneration

As a customer whose Pix payment window has expired,
I want to generate a new Pix key,
So that I can still complete payment without losing my order slot.

**Acceptance Criteria:**

**Given** an order has status `aguardando_pagamento` and `pix_expires_at` is in the past
**When** the customer visits `/checkout/[orderId]`
**Then** the page shows: "Seu tempo para pagar expirou." and a "Gerar novo Pix" button
**And** the expired Pix key is NOT shown

**Given** the customer taps "Gerar novo Pix"
**When** the Server Action processes the request
**Then** it updates the order's `pix_expires_at` to 30 minutes from now
**And** returns `{ success: true }` and the page re-renders showing the Pix key with a fresh 30-minute countdown

**Given** the customer taps "Gerar novo Pix" for an order with status `confirmado` or `cancelado`
**When** the Server Action validates
**Then** it returns `{ success: false, error: 'Este pedido não pode ser atualizado.' }`
**And** no database write occurs

**Given** the checkout page is open and the timer reaches zero
**When** the countdown hits 00:00
**Then** the UI transitions to the expired state and shows the "Gerar novo Pix" button without requiring a page reload

---

### Story 3.4: Order Cancellation Before Payment

As a customer with an unpaid order,
I want to cancel my order,
So that I can free up my slot and receive confirmation that the cancellation went through.

**Acceptance Criteria:**

**Given** the customer views `/checkout/[orderId]` with status `aguardando_pagamento`
**When** the page renders
**Then** a "Cancelar pedido" button is visible

**Given** the customer taps "Cancelar pedido" and confirms
**When** the Server Action processes the cancellation
**Then** it updates the order status to `cancelado`
**And** the customer's slot for that delivery date is effectively freed (order count query excludes `cancelado` rows, per Story 3.1)
**And** `sendMessage()` sends a WhatsApp to the customer: "Seu pedido #XXXX foi cancelado. Esperamos te ver em breve! 🍱 — Seu Laerte"
**And** returns `{ success: true }` and the page shows: "Pedido cancelado."

**Given** the order has status `confirmado` (payment already confirmed by Laerte)
**When** the Server Action receives a cancel request
**Then** it returns `{ success: false, error: 'Pedidos já confirmados não podem ser cancelados.' }`
**And** no database write occurs
**And** the "Cancelar pedido" button is not shown on the checkout page for confirmed orders

**Given** the Z-API sendMessage call fails during cancellation
**When** the Server Action catches the error
**Then** the order is still marked `cancelado` in the database (cancellation succeeds)
**And** the failure is logged server-side for manual follow-up
**And** the customer sees the cancellation confirmation (WhatsApp delivery failure is non-blocking)

---

## Epic 4: Notifications, Operations & Laerte's Tools

Customers receive the full WhatsApp communication lifecycle (order confirmation, Sunday menu reveal, morning dish story, 1pm rating prompt, cancellation confirmation). Laerte receives a new-order alert on every placement and a nightly email with an Excel attachment listing next-day orders — enabling zero-waste production planning. Admin can schedule notification content and view per-day order counts.

### Story 4.1: New Order Alert & Payment Confirmation via WhatsApp

As Laerte,
I want to receive a WhatsApp alert when a new order is placed and confirm payment by replying "PAGO XXXX",
So that I can track orders in real time and trigger customer confirmations without touching any app.

**Acceptance Criteria:**

**Given** a customer successfully places an order (Story 3.1 completes)
**When** the order is inserted
**Then** `sendMessage()` is called with `LAERTE_PHONE` and a message containing: order display ID, customer name, customer phone, delivery date, and amount (e.g. "Novo pedido! #0023 — Ana Silva (+5511...) — Quinta-feira 10/04 — R$35,00")
**And** the Z-API call failure is logged but does NOT block order creation (non-blocking)

**Given** the Z-API webhook endpoint `/api/webhooks/zapi` exists
**When** a request arrives without the correct `?token=WEBHOOK_SECRET` query param
**Then** the handler returns HTTP 401 and logs the attempt

**Given** a valid webhook request arrives from Z-API
**When** the handler parses the payload and the sender phone matches `LAERTE_PHONE` AND the message body matches `/^PAGO\s+(\d{4})$/i`
**And** an order with that `display_id` exists with status `aguardando_pagamento`
**Then** the order status is updated to `confirmado`
**And** `sendMessage()` is called with the customer's phone: "Pedido confirmado! [Dia da semana], [data] às 11h45 no lobby. Até lá! 🍱 — Seu Laerte"
**And** the handler returns HTTP 200

**Given** Laerte sends `PAGO 0023` but order `0023` already has status `confirmado`
**When** the webhook handler processes it
**Then** it returns HTTP 200 without re-sending the confirmation (idempotent — no duplicate notification)

**Given** any inbound WhatsApp message that does NOT match the PAGO pattern or is NOT from `LAERTE_PHONE`
**When** the webhook handler evaluates it
**Then** it logs the message and returns HTTP 200 (ignored silently)

**Given** Laerte sends `PAGO 9999` but no order with `display_id = '9999'` exists
**When** the webhook handler looks up the order
**Then** it logs the error and returns HTTP 200 (no crash, no customer notification)

---

### Story 4.2: Nightly Email with Excel Order List

As Laerte,
I want to receive an automated email every night with tomorrow's order list as an Excel file,
So that I can plan production quantities and shop for exact ingredients with zero guesswork.

**Acceptance Criteria:**

**Given** `vercel.json` is reviewed
**When** cron jobs are listed
**Then** it defines a cron at `0 3 * * *` (midnight Brasília, UTC-3) calling `/api/cron/nightly-email`

**Given** the cron fires at midnight
**When** `/api/cron/nightly-email` is called
**Then** it validates the `Authorization: Bearer CRON_SECRET` header; requests without it return HTTP 401

**Given** a valid cron request arrives
**When** the handler queries the database
**Then** it fetches all orders for tomorrow's date with status `confirmado` or `aguardando_pagamento`, joining `customers` (name, phone) and `menu_items` (dish name)

**Given** the order list is fetched
**When** the handler generates the Excel file
**Then** it uses `xlsx` to create a workbook with columns: `#` (display_id), `Nome`, `Telefone`, `Prato`, `Status`
**And** rows are sorted by display_id ascending

**Given** the Excel file is generated
**When** the handler calls Resend
**Then** it sends an email to `LAERTE_EMAIL` with subject "Pedidos para amanhã — [Dia da semana, data]" and the Excel file attached as `pedidos-[date].xlsx`
**And** the handler returns HTTP 200

**Given** zero orders exist for tomorrow
**When** the handler runs
**Then** it sends the email with an empty Excel (header row only) and subject "Pedidos para amanhã — [data] (nenhum pedido)"

**Given** the Resend call fails
**When** the handler catches the error
**Then** it logs the full error with context
**And** sends a fallback WhatsApp to `LAERTE_PHONE` via `sendMessage()`: "⚠️ Erro ao enviar o email com os pedidos. Verifique manualmente."
**And** returns HTTP 500

---

### Story 4.3: Morning Dish Story & 1pm Rating Prompt Crons

As a customer with a confirmed order for today,
I want to receive a WhatsApp message in the morning about my dish and a rating prompt after lunch,
So that I stay engaged and can easily rate my meal with one tap.

**Acceptance Criteria:**

**Given** `vercel.json` is reviewed
**When** cron jobs are listed
**Then** `0 11 * * 1-5` (8am Brasília weekdays) calls `/api/cron/morning-story`
**And** `0 16 * * 1-5` (1pm Brasília weekdays) calls `/api/cron/rating-prompt`

**Given** the morning story cron fires at 8am on a weekday
**When** `/api/cron/morning-story` runs with valid `Authorization: Bearer CRON_SECRET`
**Then** it fetches today's `menu_items` row for the dish name and description
**And** fetches all customers with a `confirmado` order for today
**And** calls `sendMessage()` for each customer with the dish story message (text sourced from the `morning_message` field on the `menu_items` row, falling back to dish name and description)

**Given** the 1pm rating prompt cron fires
**When** `/api/cron/rating-prompt` runs
**Then** it fetches all customers with a `confirmado` order for today
**And** calls `sendMessage()` for each: "Como foi o almoço hoje? 🍽️ Clique para avaliar: [link to /rate/[orderId]]"
**And** each customer receives exactly one rating prompt per order (idempotent: checks `rating_prompt_sent_at` on the order row; skips if already set)
**And** sets `rating_prompt_sent_at = now()` on the order row after sending

**Given** a `ratings` table migration
**When** reviewed
**Then** it has: `id` bigserial PK, `order_id` bigint FK → `orders.id` unique, `customer_id` bigint FK → `customers.id`, `stars` smallint not null (1–5), `created_at`

---

### Story 4.4: Sunday Menu Reveal & Admin Notification Scheduling

As a customer,
I want to receive the upcoming week's full menu via WhatsApp every Sunday evening,
So that I can plan my week and place orders early.

**Acceptance Criteria:**

**Given** `vercel.json` is reviewed
**When** cron jobs are listed
**Then** `0 23 * * 0` (8pm Brasília Sunday) calls `/api/cron/menu-reveal`

**Given** the Sunday cron fires
**When** `/api/cron/menu-reveal` runs with valid auth
**Then** it fetches next week's `menu_items` rows
**And** fetches all customers with `whatsapp_consent = true`
**And** sends each customer a WhatsApp message listing the full week's menu (day + dish name per line), followed by a CTA: "Faça seu pedido em [URL]"

**Given** no next-week menu exists in the database
**When** the cron runs
**Then** it logs a warning and exits without sending any messages

**Given** Laerte navigates to `/admin/notifications`
**When** the page loads
**Then** he sees a form to set the `morning_message` for each day of the current week
**And** a preview of the Sunday menu reveal message auto-generated from next week's menu items

**Given** Laerte submits a morning message for a specific day
**When** the Server Action processes it
**Then** it updates the `morning_message` field on the corresponding `menu_items` row
**And** returns `{ success: true }`

---

### Story 4.5: Admin Order Count View

As Laerte (admin),
I want to see confirmed order counts per day at a glance,
So that I know how many marmitas to prepare and when days are approaching capacity.

**Acceptance Criteria:**

**Given** Laerte navigates to `/admin/orders`
**When** the page loads
**Then** he sees a table listing each delivery day in the current week with: date, day of week, confirmed order count, and remaining capacity (100 − count)
**And** days at 100 show "Esgotado" highlighted

**Given** Laerte views the order count for a specific day
**When** he clicks on that day
**Then** he sees the full order list for that day: display ID, customer name, customer phone, dish name, status
**And** the list is sorted by display_id ascending (matching the nightly email order)

**Given** the page data is fetched
**When** it is rendered
**Then** it uses `SUPABASE_SERVICE_ROLE_KEY` via `createServerClient()` on the server — never exposed to the browser

---

## Epic 5: Compliance & Ratings

Customers can submit meal ratings and data deletion requests. The platform meets its LGPD obligations.

### Story 5.1: Meal Rating Submission

As a customer who received the 1pm rating prompt,
I want to submit a star rating for my meal,
So that Seu Laerte knows how I felt about today's dish.

**Acceptance Criteria:**

**Given** the customer follows the rating link `/rate/[orderId]` from their WhatsApp prompt
**When** the page loads
**Then** it displays the dish name, delivery date, and a 1–5 star selector
**And** the page is marked `noindex`
**And** if the customer is not authenticated, they are redirected to `/login` first (middleware protection)

**Given** the customer selects a star rating and submits
**When** the Server Action processes the rating
**Then** it validates the `order_id` belongs to the authenticated customer
**And** inserts a row into `ratings` (`order_id`, `customer_id`, `stars`)
**And** returns `{ success: true }` and the page shows: "Obrigado pela avaliação! Até amanhã. 🍱"

**Given** the customer attempts to rate the same order twice
**When** the Server Action runs
**Then** the `UNIQUE` constraint on `ratings.order_id` prevents a duplicate insert
**And** it returns `{ success: false, error: 'Você já avaliou este pedido.' }`

**Given** the customer follows a rating link for an order that does not belong to them
**When** the Server Action validates ownership
**Then** it returns `{ success: false, error: 'Pedido não encontrado.' }`
**And** no rating is inserted

**Given** the rating UI on mobile
**When** rendered at 375px width
**Then** each star is at least 44×44px in touch target size

---

### Story 5.2: Customer Data Deletion Request

As a customer,
I want to submit a request for deletion of my personal data,
So that I can exercise my LGPD rights.

**Acceptance Criteria:**

**Given** an authenticated customer navigates to `/conta/deletar`
**When** the page loads
**Then** it displays a short explanation of what deletion means and a confirmation button: "Solicitar exclusão dos meus dados"

**Given** the customer confirms the deletion request
**When** the Server Action processes it
**Then** it sends an email to `LAERTE_EMAIL` (via Resend) with subject "Solicitação de exclusão de dados" containing the customer's phone number and the request timestamp
**And** returns `{ success: true }` and the page shows: "Solicitação recebida. Seus dados serão excluídos em até 15 dias úteis."
**And** the customer receives a WhatsApp confirmation: "Recebemos sua solicitação de exclusão de dados. Em até 15 dias úteis, seus dados serão removidos."

**Given** the deletion request email fails to send
**When** the Server Action catches the error
**Then** it logs the error with the customer's identifier for manual follow-up
**And** still shows the customer the confirmation message (request is recorded in logs)

**Given** an unauthenticated visitor navigates to `/conta/deletar`
**When** middleware evaluates the request
**Then** they are redirected to `/login`
