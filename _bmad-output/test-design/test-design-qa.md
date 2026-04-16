---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-13'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

# Test Design for QA: Marmita do Seu Laerte — System-Level

**Purpose:** Test execution recipe for Lucas (acting as QA). Defines what to test, how to test it, and what infrastructure is needed.

**Date:** 2026-04-13
**Author:** BMad TEA (Master Test Architect)
**Status:** Draft — Pre-launch review
**Project:** Marmita do Seu Laerte

**Related:** See `test-design-architecture.md` for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Full system test coverage for the Marmita do Seu Laerte platform — all 5 epics (Auth, Menu, Orders/Payments, Notifications, Ratings/Account), ready to validate before the first real customer launch.

**Risk Summary:**
- Total Risks: 12 (4 high ≥6, 5 medium 3-5, 3 low 1-2)
- Critical Categories: SEC (webhook auth, Z-API SPOF), DATA (concurrent capacity), OPS (bulk WhatsApp)

**Coverage Summary:**
- P0 tests: ~14 (critical paths — auth, order, payment confirmation, route protection)
- P1 tests: ~18 (important features — capacity logic, notifications, admin, ratings)
- P2 tests: ~12 (edge cases — OTP expiry, session handling, accessibility)
- P3 tests: ~8 (exploratory — message content, idempotency, observability)
- **Total:** ~52 scenarios (~3–5 weeks, 1 developer part-time)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Mercado Pago integration** | Not built (MVP uses manual Pix) | No payment gateway in scope; Pix key display is server-side only |
| **Subscription management** | Phase 2 feature, not implemented | Not in MVP scope |
| **Performance/load testing** | Scale is <100 orders/day; Vercel free tier handles it | Monitor Vercel Analytics on launch day; escalate if degradation observed |
| **Real Z-API WhatsApp message content** | Sending to real numbers in tests is not feasible | Z-API mocked via `ZAPI_MOCK=true`; content checked via logged output |
| **Cross-browser visual regression** | Not in MVP scope | Manual spot-check on iOS Safari + Chrome before launch |

---

## Dependencies & Test Blockers

**CRITICAL — QA cannot proceed without these:**

### Architecture Fixes Required First (Pre-Test)

1. **`ZAPI_MOCK=true` environment variable** — Lucas — Before any test is written
   - `src/lib/zapi.ts` must check this flag and skip real HTTP calls
   - Without this, every auth test fires a real WhatsApp to the test phone number

2. **Webhook secret moved from URL to header** — Lucas — Pre-launch
   - `WEBHOOK_SECRET` must be validated from `X-Webhook-Token` header, not `?token=`
   - Test suite validates the new header-based auth pattern

3. **Supabase test project provisioned** — Lucas — Before integration tests
   - Separate project with same schema migrations applied
   - `.env.test` file with test credentials documented

### QA Infrastructure Setup

1. **Test frameworks to install:**
   ```bash
   cd marmita-seu-laerte
   npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
   npm install -D playwright @playwright/test
   npm install -D @faker-js/faker
   npx playwright install chromium
   ```

2. **`vitest.config.ts`** — for unit and server action tests:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
     },
   })
   ```

3. **`playwright.config.ts`** — for E2E and API tests:
   ```typescript
   import { defineConfig } from '@playwright/test'
   export default defineConfig({
     testDir: './tests/e2e',
     use: {
       baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
       extraHTTPHeaders: { 'x-test-env': 'true' },
     },
     projects: [{ name: 'chromium', use: { channel: 'chrome' } }],
   })
   ```

4. **Test data helper** — `src/test/factories.ts`:
   ```typescript
   import { faker } from '@faker-js/faker/locale/pt_BR'
   export const makePhone = () => `+5511${faker.string.numeric(9)}`
   export const makeOtp = () => faker.string.numeric(6)
   export const makeDisplayId = () => faker.string.numeric(4).padStart(4, '0')
   ```

---

## Risk Assessment (QA Summary)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|-----------------|
| **R-001** | SEC | Z-API OTP SPOF — number ban = no login | **6** | P0-001, P0-002: OTP happy path + failure graceful error |
| **R-002** | DATA | Concurrent order capacity race condition | **6** | P0-010: Concurrent placement test (10 simultaneous requests, 1 slot) |
| **R-003** | SEC | Webhook secret in URL query param | **6** | P0-011: Webhook with wrong/missing header → 401 |
| **R-004** | OPS | Bulk WhatsApp from menu reveal | **6** | P1-016: Menu reveal cron completes without timeout; sequential confirmed in logs |
| R-005 | BUS | PAGO typo leaves order unconfirmed | 4 | P1-009: PAGO parsing — whitespace, case variants, wrong ID |
| R-006 | TECH | proxy.ts non-standard pattern | 3 | P0-012: Unauthenticated access to `/order` redirects to `/login` |
| R-007 | BUS | Capacity display vs actual discrepancy | 4 | P1-006: Full day at `aguardando_pagamento` rejects new orders |
| R-008 | SEC | 30-day JWT cookie — no revocation | 3 | P2-009: Cookie attributes (httpOnly, secure, sameSite=strict) |
| R-009 | OPS | Nightly email fallback also fire-and-forget | 3 | P1-014: Resend failure triggers fallback WhatsApp |

---

## Entry Criteria

- [ ] Architecture blockers resolved: `ZAPI_MOCK`, webhook header auth, sequential menu reveal sends
- [ ] Supabase test project provisioned with schema migrations applied
- [ ] `.env.test` documented and shared
- [ ] Vitest + Playwright installed and running `npx vitest run` + `npx playwright test` without errors
- [ ] `npm run build` passes without TypeScript errors (`tsc --noEmit`)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (≥95%, failures triaged)
- [ ] R-001, R-002, R-003, R-004 mitigations verified by tests
- [ ] No TypeScript build errors
- [ ] Manual smoke test: full Ana journey (OTP → order → Pix display → Laerte PAGO → rating) on staging

---

## Project Team

| Name | Role | Testing Responsibilities |
|------|------|--------------------------|
| Lucas | Developer + QA | All test implementation, architecture fixes, launch validation |

---

## Test Coverage Plan

**P0/P1/P2/P3 = risk priority, not execution order.** All P0+P1 run on every PR. See Execution Strategy for timing.

---

### P0 (Critical) — Every Commit, No Exceptions

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround

| Test ID | Requirement | Test Scenario | Test Level | Risk Link | Notes |
|---------|-------------|---------------|------------|-----------|-------|
| **P0-001** | FR1 | OTP request: valid Brazilian phone → Z-API called (mocked), OTP stored hashed in `otp_codes` | Unit (server action) | R-001 | Mock `sendMessage`, verify DB write |
| **P0-002** | FR1 | OTP verify: correct code → session cookie set, redirect to `/order` | Integration | R-001 | Verify cookie `session` exists with 30-day maxAge |
| **P0-003** | FR1 | OTP verify: incorrect code → error returned, no session created | Unit | R-001 | Returns `{ success: false, error: 'Código inválido...' }` |
| **P0-004** | FR2 | OTP resend: second request for same phone → new code generated, old code still in DB | Unit | R-001 | Old code is not deleted; new code is fresh |
| **P0-005** | FR9 | Order placement: authenticated customer, available day, available slot → order created, display_id returned | Integration | R-002 | Uses real test DB |
| **P0-006** | FR13 | Order placement: day at 100 confirmed orders → rejected with capacity error | Integration | R-002 | Insert 100 `confirmado` rows first |
| **P0-007** | FR14 | Order placement: delivery date = today or past → rejected with cutoff error | Unit | — | Server action validates `deliveryDate <= todayBrasilia` |
| **P0-008** | FR15 | Checkout page: first visit initializes `pix_expires_at` (now + 30 min), sets `pix_key` from env | Integration | — | Verify DB row updated; key visible in response |
| **P0-009** | FR11 | Order cancellation: `aguardando_pagamento` order → status set to `cancelado` | Integration | — | Verify slot is freed (subsequent order for same date succeeds) |
| **P0-010** | NFR13 | Concurrent capacity: 10 simultaneous `place_order` calls for same date with 1 slot remaining → exactly 1 succeeds | Integration | R-002 | Run 5 times; 0 race-through tolerance |
| **P0-011** | NFR16 | Webhook auth: POST to `/api/webhooks/zapi` without `X-Webhook-Token` header → 401 | API | R-003 | After R-003 fix (header-based auth) |
| **P0-012** | NFR | Route protection: GET `/order` without session cookie → redirect to `/login?from=/order` | E2E | R-006 | Validates proxy.ts is running |
| **P0-013** | NFR | Route protection: GET `/admin/menu` without Laerte's phone in session → redirect to `/` | E2E | R-006 | Non-admin authenticated user gets bounced |
| **P0-014** | FR12 | Order cancellation: `confirmado` order → rejected with Portuguese error | Unit | — | Returns `{ success: false, error: 'Pedidos já confirmados não podem ser cancelados.' }` |

**Total P0:** 14 tests

---

### P1 (High) — Every PR to Main

**Criteria:** Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Scenario | Test Level | Risk Link | Notes |
|---------|-------------|---------------|------------|-----------|-------|
| **P1-001** | FR17 | Pix countdown: `CountdownTimer` reaches 0:00 → `onExpire` fires once (not repeatedly) | Unit (component) | — | Test timer hook in isolation |
| **P1-002** | FR18 | Pix regeneration: `renewPixExpiry` on expired order → new `pix_expires_at` returned, timer resets | Integration | — | Verify DB update + returned timestamp |
| **P1-003** | FR18 | Pix regeneration: `renewPixExpiry` on already-`confirmado` order → rejected | Unit | — | Returns `{ success: false, error: 'Este pedido não pode ser atualizado.' }` |
| **P1-004** | FR5 | Public menu page: serves correct week's dishes with availability counts, no auth required | E2E | — | Playwright: visit `/menu`, verify dish names visible |
| **P1-005** | FR6 | Public menu page: day at capacity shows "Esgotado" label, order button disabled | E2E | — | Seed 100 `confirmado` orders for a test date |
| **P1-006** | R-007 | Capacity accuracy: day with 100 `aguardando_pagamento` orders → `place_order` still rejected | Integration | R-007 | Validates `status != 'cancelado'` capacity logic |
| **P1-007** | FR7 | Admin creates new menu week: form submission → week + items inserted, public menu updates | Integration | — | `createMenuWeek` server action + verify `revalidatePath` effect |
| **P1-008** | FR7 | Admin updates menu item: inline edit → `updateMenuItem` persists change | Integration | — | Verify DB update; return to admin list shows new value |
| **P1-009** | FR24+webhook | Webhook: Laerte sends `PAGO 0042` → order `0042` set to `confirmado`, customer WhatsApp fired (mocked) | Integration | R-005 | Test variants: `pago 0042`, `PAGO  0042` (extra space), `PAGO 0999` (unknown ID) |
| **P1-010** | NFR16 | Webhook idempotency: `PAGO 0042` sent twice → second request returns 200 without re-sending notification | Integration | — | First call confirms; second call is a no-op |
| **P1-011** | FR25 | Nightly email cron: POST to `/api/cron/nightly-email` with valid `CRON_SECRET` → Resend called (mocked), Excel attachment generated | API | R-009 | Mock Resend; verify xlsx is well-formed |
| **P1-012** | FR21 | Morning story cron: fires for each confirmed order on today's date, sends `morning_message` (mocked) | API | — | Seed 3 orders for today; verify 3 sendMessage calls |
| **P1-013** | FR22 | Rating prompt cron: fires for confirmed orders without `rating_prompt_sent_at`, sets field after send | API | — | Idempotency: second cron run skips already-sent orders |
| **P1-014** | NFR11 | Nightly email fallback: Resend throws → fallback `sendMessage` to Lucas/Laerte attempted (mocked) | Unit | R-009 | Mock Resend to reject; verify fallback WhatsApp logged |
| **P1-015** | FR20 | Sunday menu reveal cron: sends next-week menu to all consenting customers (mocked); skips if no next week | API | R-004 | After sequential send fix: verify sends are sequential (not parallel) |
| **P1-016** | FR26 | Admin notification page: `updateMorningMessage` persists to `menu_items.morning_message` | Integration | — | Server action + verify DB update |
| **P1-017** | FR31 | Rating submission: `submitRating(orderId, 5)` → inserts into `ratings` table | Integration | — | Verify ownership check passes |
| **P1-018** | FR31 | Duplicate rating: second `submitRating` for same order → rejected with Portuguese duplicate message | Unit | — | Catches Postgres `23505` uniqueness violation |

**Total P1:** 18 tests

---

### P2 (Medium) — Nightly / Pre-Release Regression

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Scenario | Test Level | Risk Link | Notes |
|---------|-------------|---------------|------------|-----------|-------|
| **P2-001** | NFR7 | OTP expiry: code submitted after 10 minutes → rejected with expiry error | Integration | — | Set `expires_at = now() - 1s` directly in test DB |
| **P2-002** | NFR7 | OTP single-use: same code submitted twice → second submission rejected | Integration | — | After first successful verify, `used_at` is set |
| **P2-003** | FR10 | Order status page: shows most recent order with correct Portuguese status label | E2E | — | Visit `/order/status` after placing an order |
| **P2-004** | FR3 | Session persistence: 30-day cookie present in response after OTP verify | Integration | R-008 | Check `Set-Cookie` header attributes |
| **P2-005** | R-008 | Session cookie attributes: `httpOnly`, `Secure`, `SameSite=Strict` | Integration | R-008 | Parse `Set-Cookie` header; verify all three flags |
| **P2-006** | FR28 | LGPD consent: signup without checking consent checkbox → form submission blocked | E2E | — | Playwright: submit login form without consent; verify error |
| **P2-007** | FR29 | Privacy policy accessible: `/privacy` returns 200 without auth | E2E | — | Playwright: visit unauthenticated; verify content visible |
| **P2-008** | FR30 | Data deletion request: `requestDeletion()` → Resend email sent (mocked); returns `{ success: true }` | Unit | — | Non-blocking; success even if email fails |
| **P2-009** | NFR1 | Public menu LCP: Lighthouse CI on `/menu` verifies LCP < 2.5s | E2E (Lighthouse) | — | Run in CI nightly; not in PR gate |
| **P2-010** | FR5 | Menu page SEO: `/menu` has `<title>`, `<meta description>`, not `noindex` | E2E | — | Playwright: check `document.title` + meta tags |
| **P2-011** | NFR18 | Touch targets: OTP input boxes and order buttons are at least 44×44px | Component | — | Computed style check in Playwright |
| **P2-012** | R-011 | `SUPABASE_SERVICE_ROLE_KEY` not in any client bundle: verify no `service_role` string in built JS | Build (grep) | R-012 | `grep -r "service_role" .next/static` → zero matches |

**Total P2:** 12 tests

---

### P3 (Low) — On-Demand / Manual

**Criteria:** Nice-to-have + Exploratory + Content verification

| Test ID | Requirement | Test Scenario | Test Level | Notes |
|---------|-------------|---------------|------------|-------|
| **P3-001** | NFR16 | Webhook: non-PAGO message from Laerte's phone → logged, 200, no order changes | API | e.g., "Boa tarde" message |
| **P3-002** | NFR16 | Webhook: `PAGO 0001` from unknown (non-Laerte) phone → ignored, 200 | API | Validates sender phone check |
| **P3-003** | FR19 | Payment confirmation WhatsApp content: verify message text contains display_id, delivery date, emoji | Manual | Check mocked log output |
| **P3-004** | FR24 | New order alert to Laerte: verify message contains customer name, phone, date, price | Manual | Check mocked log output |
| **P3-005** | R-010 | Cron schedule accuracy: verify first week's cron fires at correct Brasília local times | Manual (monitor) | Check Vercel cron logs after deployment |
| **P3-006** | FR8 | Public menu SSR: page renders without JavaScript in browser (SSR verification) | E2E | Playwright: disable JS, visit `/menu`, verify content visible |
| **P3-007** | NFR19 | Error message accessibility: OTP invalid code error is text-based, not color-only indicator | E2E | Playwright: inspect error element has visible text |
| **P3-008** | R-011 | `otp_codes` table cleanup: expired codes from last week not accumulating in DB | Manual (DB query) | Run `SELECT COUNT(*) FROM otp_codes WHERE expires_at < now() - interval '24 hours'` |

**Total P3:** 8 tests

---

## Execution Strategy

### Every PR (~15 min target)
- All Vitest unit tests (P0-001–003, P0-007, P0-014, P1-001, P1-003, P1-014, P1-018, P2-008)
- All Playwright API/integration tests against test Supabase (P0-005, P0-006, P0-008–013, P1-002, P1-004–013, P1-015–017, P2-001–007, P2-010, P3-001–002)
- P0 concurrent test (P0-010) — must always run
- Build verification: `tsc --noEmit` + `npm run build`

### Nightly (~30 min)
- P2-009 (Lighthouse LCP — requires headful browser)
- P2-011 (Touch target sizes)
- P2-012 (Service role key bundle check)

### Pre-Launch Manual
- Full Ana journey E2E on staging (OTP → order → Pix display → PAGO webhook → confirmation → rating)
- P3-003–P3-005 (content verification, cron timing spot-check)
- Cross-browser: iOS Safari + Android Chrome

### Manual Only (Excluded from Automation)
- P3-006–P3-008 (SSR check, accessibility inspection, DB cleanup check)
- Cron fire time monitoring (P3-005)

---

## QA Effort Estimate

| Priority | Count | Effort Range | Notes |
|----------|-------|-------------|-------|
| P0 | 14 | ~1.5–2 weeks | Concurrent test + webhook auth + route protection setup cost |
| P1 | 18 | ~1.5–2 weeks | Cron mocking + integration fixtures are the main effort |
| P2 | 12 | ~3–5 days | Most are simple assertions once P0/P1 infrastructure is in place |
| P3 | 8 | ~1–2 days | Mostly manual; a few quick API tests |
| **Total** | **52** | **~3–5 weeks** | **Lucas, part-time (alongside fixes)** |

**Critical pre-requisite work** (not counted above):
- `ZAPI_MOCK=true` implementation: ~2–4 hours
- Webhook header auth (R-003): ~2 hours
- Sequential menu reveal sends (R-004): ~1 hour
- Supabase test project setup: ~1–2 hours
- Test framework install + config: ~2–3 hours

---

## Implementation Planning Handoff

| Work Item | Owner | Priority | Notes |
|-----------|-------|----------|-------|
| `ZAPI_MOCK=true` flag in `src/lib/zapi.ts` | Lucas | **BLOCKER** | Must complete before any test |
| Move webhook auth to request header | Lucas | **BLOCKER** | R-003 mitigation |
| Sequential menu reveal sends (500ms delay) | Lucas | Pre-launch | R-004 mitigation |
| Supabase test project + `.env.test` | Lucas | Pre-test | |
| Install Vitest + Playwright + faker | Lucas | Pre-test | |
| Write P0 unit tests | Lucas | Sprint 1 | Start here |
| Write P0 integration tests | Lucas | Sprint 1 | Needs test DB ready |
| Write P1 tests | Lucas | Sprint 2 | After P0 passes |
| Write P2/P3 tests | Lucas | Sprint 3 / post-launch | |

---

## Tooling & Access

| Tool | Purpose | Status |
|------|---------|--------|
| Vitest + Testing Library | Unit / component tests | To install |
| Playwright | E2E + API integration tests | To install |
| @faker-js/faker | Test data generation | To install |
| Supabase test project | Isolated test DB | To provision |
| Vercel preview deployments | Staging env for E2E | Available (already on Vercel) |

---

## Interworking & Regression

| Component | Impact | Regression Scope |
|-----------|--------|-----------------|
| **`src/proxy.ts` (route protection)** | Auth and admin guard | P0-012, P0-013 must pass on every Next.js upgrade |
| **`src/lib/zapi.ts`** | All OTP + notification sends | Any change requires P0-001, P0-002 pass |
| **`place_order` Postgres RPC** | Capacity + concurrency | P0-005, P0-006, P0-010 must pass after any DB migration |
| **`/api/webhooks/zapi`** | Payment confirmation | P0-011, P1-009, P1-010 must pass after any webhook change |
| **Vercel cron routes** | Notifications + nightly email | P1-011–P1-015 must pass after any cron logic change |

---

## Appendix A: Test Tags Reference

```typescript
// P0 critical — run on every commit
test('@P0 @Auth @Unit OTP verify: correct code creates session', async () => { ... })
test('@P0 @Order @Integration place_order with capacity', async () => { ... })
test('@P0 @Concurrent place_order race condition', async () => { ... })
test('@P0 @Webhook @Security no token returns 401', async () => { ... })
test('@P0 @E2E @Routes unauthenticated /order redirects to /login', async () => { ... })

// P1 important — run on PR to main
test('@P1 @Order @Integration pix regeneration on expired order', async () => { ... })
test('@P1 @Webhook PAGO command parsing variants', async () => { ... })
test('@P1 @Cron @API nightly email generates xlsx', async () => { ... })

// P2 regression
test('@P2 @Auth OTP expires after 10 minutes', async () => { ... })
test('@P2 @Security session cookie has httpOnly and Secure', async () => { ... })
```

**Run specific tags:**
```bash
# P0 tests only (CI fast gate)
npx playwright test --grep "@P0"
npx vitest run --reporter=verbose

# P0 + P1 (full PR gate)
npx playwright test --grep "@P0|@P1"

# Security tests only
npx playwright test --grep "@Security"

# Concurrent race test (run multiple times to confirm)
npx playwright test --grep "@Concurrent" --repeat-each=5
```

---

## Appendix B: Test File Layout

```
marmita-seu-laerte/
  src/
    test/
      setup.ts              # Vitest global setup (env vars, DB client)
      factories.ts          # Test data helpers (makePhone, makeOtp, etc.)
    actions/
      orders.test.ts        # Unit tests for order server actions
      auth.test.ts          # Unit tests for OTP request/verify actions
      ratings.test.ts       # Unit tests for rating submission
    lib/
      zapi.test.ts          # Unit test for sendMessage mock behavior
  tests/
    e2e/
      auth.spec.ts          # OTP flow, route protection, session
      order.spec.ts         # Full order placement E2E
      menu.spec.ts          # Public menu display, admin management
      checkout.spec.ts      # Pix display, expiry, regeneration, cancellation
      rating.spec.ts        # Rating submission, duplicate prevention
      account.spec.ts       # Data deletion request
    api/
      webhook.spec.ts       # PAGO parsing, auth, idempotency
      cron.spec.ts          # Nightly email, morning story, rating prompt, menu reveal
    concurrent/
      capacity.spec.ts      # Race condition test (P0-010)
```

---

**Generated by:** BMad TEA Agent — Master Test Architect
**Workflow:** `bmad-testarch-test-design`
**Version:** System-Level (Phase 3)
