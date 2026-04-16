---
stepsCompleted: ['step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-12'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

# Test Design for Architecture: Marmita do Seu Laerte

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before integration test development begins.

**Date:** 2026-04-12
**Author:** BMad Test Architect (automated)
**Status:** Architecture Review Pending
**Project:** Marmita do Seu Laerte
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md`

---

## Executive Summary

**Scope:** Full-stack Next.js 16 marmita delivery platform — authentication (WhatsApp OTP), ordering, Pix payment, WhatsApp notifications, admin ops, meal ratings, and LGPD compliance. All 5 epics (17 stories) are implemented.

**Business Context (from PRD):**

- **Revenue/Impact:** Primary revenue path — Pix checkout processes real payments. Zero-waste production model means every lost order = lost revenue AND wasted ingredients.
- **Problem:** Pre-order-driven marmita delivery for corporate workers in Faria Lima. Capacity hard cap of 100/day. Concurrent ordering must not oversell.
- **Target scale:** 100 marmitas/day (fully booked). Low concurrency; Vercel + Supabase free tier sufficient for MVP.

**Architecture (from ADR):**

- **Key Decision 1:** Custom WhatsApp OTP auth (Z-API) — no NextAuth. Session = signed JWT (HS256, 30-day cookie). Single point of failure for auth.
- **Key Decision 2:** Pix payment confirmed manually — Laerte replies `PAGO 0001` via WhatsApp → Z-API webhook → server marks `confirmado`. Atomic capacity check via Postgres advisory lock.
- **Key Decision 3:** Vercel Cron Jobs for 4 scheduled operations (nightly email, morning story, 1pm rating prompt, Sunday menu reveal). All UTC-mapped.

**Expected Scale:** ~100 orders/day, very low concurrency, mobile-first users (iOS/Android).

**Risk Summary:**

- **Total risks identified:** 12
- **High-priority (score ≥6):** 4 risks requiring test coverage (R03, R04, R06, R08)
- **Medium (score 4–5):** 4 risks (R05, R07, R11, R12)
- **Low (score 1–3):** 4 risks — already mitigated or architectural guarantee
- **Test effort:** ~43–77 hours (solo developer, Lucas)

---

## Quick Guide

### 🚨 BLOCKERS — Must Resolve Before Integration Tests Can Be Written

1. **BLOCK-01: No mock boundary for `sendMessage()` (Z-API)** — `src/lib/zapi.ts` has no injectable test double. Integration tests for `requestOtp`, `placeOrder`, `cancelOrder`, `verifyOtp` will all attempt to hit real Z-API or fail silently. **Required:** add an optional `__setZApiClient` test seam OR export `sendMessage` as a replaceable module export so Vitest can `vi.mock('@/lib/zapi')`. (Owner: Lucas / Dev)

2. **BLOCK-02: Server Actions require real Supabase or a full mock** — `createServiceClient()` reads `SUPABASE_SERVICE_ROLE_KEY` at call time. No test environment is configured. **Required:** either a dedicated Supabase test project (`SUPABASE_TEST_*` env vars) OR a Vitest mock of `@/lib/supabase/server`. Without this, AUTH-API-001–003, ORDER-API-001–007 are blocked. (Owner: Lucas / Dev)

3. **BLOCK-03: Concurrency test requires real Postgres** — `place_order` RPC uses `pg_advisory_xact_lock`. This cannot be tested with a mock. **Required:** the test Supabase project (from BLOCK-02) must have the full schema + RPC migrations applied. (Owner: Lucas / Dev)

**What we need:** Resolve BLOCK-01 + BLOCK-02 before writing any integration tests. BLOCK-03 is resolved by BLOCK-02 if using a real Supabase test project.

---

### ⚠️ HIGH PRIORITY — Validate Recommendations

1. **R03: OTP bypass via expired/reused codes** — Recommend integration tests for `verifyOtp` with (a) expired `otp_codes` row, (b) already-used `otp_codes` row (`used_at` set). Validate that bcrypt compare + `used_at` guard both reject correctly. (Owner: Lucas)

2. **R04: Concurrent capacity oversell** — Recommend a concurrent integration test firing 2 simultaneous `placeOrder` calls for the 100th slot. Only one should succeed; second should return `{ success: false, error: 'Capacidade esgotada para este dia.' }`. Requires real Postgres (BLOCK-03). (Owner: Lucas)

3. **R06: Z-API SPOF for OTP auth** — Recommend stubbing `sendMessage` to throw and verifying that `requestOtp` returns a user-friendly error rather than an unhandled exception. (Owner: Lucas)

4. **R08: Admin guard bypass** — Recommend integration test for proxy redirect (non-Laerte session → GET /admin/* → 302 to /) and for `assertAdmin()` in server actions (non-Laerte JWT → `{ success: false }`). (Owner: Lucas)

---

### 📋 INFO ONLY — Solutions Already Provided (Review Only)

1. **Test strategy:** Unit (pure helpers) + Component (Vitest + RTL) + Integration (Vitest + Supabase test instance) + E2E (future Playwright). No Playwright today.
2. **Tooling:** Vitest 4.x, @testing-library/react, @testing-library/user-event, jsdom. Test scripts: `npm test` (run), `npm run test:watch` (dev).
3. **Tiered CI:** PR → P0+P1 unit/component (<2 min); Nightly → full P0–P2 suite (<15 min); Weekly → E2E + perf.
4. **Coverage:** 93 test scenarios identified (44 already written), prioritized P0–P3 with risk-based classification.
5. **Quality gates:** P0 = 100%, P1 ≥ 95%, 4 MITIGATE risks covered, branch coverage ≥ 80%.

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risks identified:** 12 (4 high-priority ≥6, 4 medium 4–5, 4 low 1–3)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|---|---|-------|------------|-------|----------|
| **R03** | **SEC** | OTP bypass: expired or reused OTP codes accepted (NFR7) | 2 | 3 | **6** | Integration tests for `verifyOtp` edge cases | Lucas | Pre-release |
| **R04** | **DATA** | Concurrent `placeOrder` oversells last slot (NFR13) | 2 | 3 | **6** | Concurrent integration test via real Postgres RPC | Lucas | Pre-release |
| **R06** | **OPS** | Z-API unavailability breaks OTP auth (SPOF) | 2 | 3 | **6** | Mock `sendMessage` failure → verify graceful error | Lucas | Pre-release |
| **R08** | **SEC** | Admin guard bypass: non-Laerte JWT accesses /admin/* | 2 | 3 | **6** | Proxy + `assertAdmin()` integration tests | Lucas | Pre-release |

#### Medium-Priority Risks (Score 4–5)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
|---------|----------|-------------|---|---|-------|------------|-------|
| R05 | BUS | PAGO webhook processes duplicate Pix confirmation (NFR16) | 2 | 2 | 4 | Idempotency test: second PAGO → 200, no resend | Lucas |
| R07 | TECH | Pix countdown client/server clock skew causes UI flicker | 2 | 2 | 4 | CountdownTimer tests cover boundary (done); cross-browser | Lucas |
| R11 | BUS | Midnight cutoff timezone edge (delivery date UTC vs Brasília) | 2 | 2 | 4 | Unit test for cutoff date logic | Lucas |
| R12 | BUS | Slot not restored after `cancelOrder` (capacity off-by-one) | 2 | 2 | 4 | Integration test: cancel → placeOrder same day | Lucas |

#### Low-Priority Risks (Score 1–3)

| Risk ID | Category | Description | P | I | Score | Action |
|---------|----------|-------------|---|---|-------|--------|
| R01 | TECH | `normalisePhone` strips `+` (was broken, now fixed) | 1 | 3 | 3 | DOCUMENT — unit test in place |
| R02 | TECH | `nextMondayFrom` wrong weekday (was broken, now fixed) | 1 | 2 | 2 | DOCUMENT — unit test in place |
| R09 | SEC | Session JWT forgery (SESSION_SECRET server-only) | 1 | 3 | 3 | DOCUMENT — architectural guarantee, code review |
| R10 | OPS | Nightly email wrong date (`tomorrowBrasilia`) | 1 | 2 | 2 | DOCUMENT — unit test in place |

---

### Testability Concerns and Architectural Gaps

#### 🚨 ACTIONABLE CONCERNS — Architecture Must Address (= BLOCK-01–03 above)

| Concern | Impact on Testing | Required Change | Owner | Timeline |
|---------|------------------|-----------------|-------|----------|
| **No mock seam for `sendMessage()`** | All integration tests for auth and notifications blocked | Export `sendMessage` as replaceable or add test injection | Lucas | Before integration test sprint |
| **No Supabase test environment** | Server Actions can't be tested without real DB | Provision Supabase test project with full schema applied | Lucas | Before integration test sprint |
| **Advisory lock requires real Postgres** | NFR13 concurrency cannot be tested with mocks | Use real Supabase test project (above) | Lucas | Resolved by above |
| **Proxy is Next.js middleware, not a plain function** | `src/proxy.ts` cannot be unit tested in Vitest (uses Next.js EdgeRuntime APIs) | Test via HTTP requests to running app (integration/E2E) | Lucas | E2E sprint |

#### Architectural Improvements Recommended (Non-Blocking)

1. **Extract OTP expiry check to a pure function**
   - **Current:** `verifyOtp` mixes bcrypt verify, DB query, `used_at` check, and session creation in one function.
   - **Suggested:** Extract `isOtpValid(code, hashedCode, expiresAt, usedAt)` as a pure function in `src/lib/otp-helpers.ts`.
   - **Benefit:** Unit-testable without Supabase. Covers R03 at unit level, faster feedback.
   - **Owner:** Lucas. Non-blocking — can be done during integration test sprint.

2. **Add `vi.mock` boundary documentation to `src/lib/zapi.ts`**
   - Add a JSDoc comment explaining how to mock in tests.
   - **Owner:** Lucas. 30-minute task.

---

### Testability Assessment Summary

#### What Works Well

- ✅ **Pure helpers fully extracted** — `src/lib/date-helpers.ts`, `src/lib/phone-helpers.ts` are 100% testable without any deps. 22 + 8 tests already written.
- ✅ **Server Actions return `{ success, error }`** — deterministic return-value contract; no throw to client. Easy to assert in tests.
- ✅ **Route Handlers return JSON + HTTP status** — cron endpoints, webhook endpoint all testable via plain `fetch` calls with `CRON_SECRET` / `WEBHOOK_SECRET`.
- ✅ **Session is a forgeable JWT** — `SESSION_SECRET` is a known env var. Tests can craft valid sessions for any phone number.
- ✅ **Pix expiry is a DB timestamp** — `pix_expires_at` insertable with any value. Expired-state tests are trivial once DB access is available.
- ✅ **Component tests cover high-interaction UI** — CountdownTimer (onExpire, 00:00 display), StarRating (aria-pressed, disabled, click) all tested.

#### Accepted Trade-offs (No Action Required)

- **No real-time subscriptions** — capacity counter refreshes on page load. Acceptable at 100 orders/day; no race condition in the UI layer.
- **Z-API as single auth channel** — no SMS fallback in MVP. Risk accepted per PRD. Mitigated by graceful error display.
- **No Playwright E2E in MVP** — solo developer (Lucas). E2E deferred to P3. Covered by integration tests for critical paths.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R03: OTP bypass via expired/reused codes (Score: 6) — SEC

**Mitigation Strategy:**

1. Extract `isOtpValid(code, hash, expiresAt, usedAt)` to `src/lib/otp-helpers.ts` (pure function).
2. Write unit tests: expired OTP → false, used OTP → false, valid OTP → true.
3. Write integration test: `verifyOtp` with expired DB row → `{ success: false, error: 'Código expirado.' }`.
4. Write integration test: `verifyOtp` with used DB row → `{ success: false, error: 'Código já utilizado.' }`.

**Owner:** Lucas | **Timeline:** Integration test sprint | **Status:** Planned
**Verification:** All 4 tests green in CI.

---

#### R04: Advisory lock fails under concurrent order placement (Score: 6) — DATA

**Mitigation Strategy:**

1. Provision Supabase test project with full schema + `place_order` RPC migration applied (BLOCK-02 prerequisite).
2. Seed: 99 confirmed orders for a test delivery date.
3. Fire 2 simultaneous `fetch` calls to `placeOrder` via `Promise.all`.
4. Assert: exactly 1 succeeds (`{ success: true }`) and 1 fails with capacity error.

**Owner:** Lucas | **Timeline:** Integration test sprint (after BLOCK-02) | **Status:** Planned
**Verification:** Test passes consistently across 10 runs (no flakiness from race conditions).

---

#### R06: Z-API unavailability breaks OTP auth (Score: 6) — OPS

**Mitigation Strategy:**

1. Mock `sendMessage` via `vi.mock('@/lib/zapi')` to throw `new Error('Z-API unreachable')`.
2. Write integration test: `requestOtp` with mocked failure → returns `{ success: false, error: 'Não foi possível enviar o código. Tente novamente.' }`.
3. Verify no unhandled exception reaches the caller.

**Owner:** Lucas | **Timeline:** After BLOCK-01 | **Status:** Planned
**Verification:** Test green, no unhandled promise rejection in CI logs.

---

#### R08: Admin guard bypass (Score: 6) — SEC

**Mitigation Strategy:**

1. **Proxy test (integration/E2E):** Make GET /admin/menu with a non-Laerte session cookie → assert 302 redirect to `/`.
2. **Server action test (integration):** Call `assertAdmin()` (or any admin server action) with a forged JWT for a different phone → assert `{ success: false, error: '...' }`.
3. **Positive test:** Laerte's phone JWT → action proceeds.

**Owner:** Lucas | **Timeline:** Integration test sprint | **Status:** Planned
**Verification:** Both tests green.

---

### Assumptions and Dependencies

#### Assumptions

1. Supabase test project will use the same schema as production (all migrations applied in order).
2. `SESSION_SECRET` in tests is a known fixed value (`test-secret-32-chars-minimum`).
3. `LAERTE_PHONE` in tests is a known fixed value (`+5511000000000`).
4. Z-API is never called in unit/component tests — always mocked.
5. E2E tests (P3) are out of scope for the current sprint and require Playwright setup.

#### Dependencies

1. **Supabase test project** — Required before integration test sprint begins.
2. **`vi.mock('@/lib/zapi')` working** — Requires `sendMessage` to be mockable (BLOCK-01 resolution).

#### Risks to the Test Plan

- **Risk:** Lucas is the sole developer + QA. Context-switching slows test development.
  - **Contingency:** Prioritize P0 tests only in first sprint. P1–P3 follow.
- **Risk:** Supabase test project migrations drift from production.
  - **Contingency:** Run migrations via `supabase db push` in CI before each test run.

---

**End of Architecture Document**

**Next Steps for Development:**

1. Resolve BLOCK-01: add mock seam to `src/lib/zapi.ts`
2. Resolve BLOCK-02: provision Supabase test project, document in `.env.test.example`
3. Consider extracting OTP validity check to pure function (recommended, non-blocking)
4. Review and sign off on risk mitigations R03–R08

**Next Steps for QA (Lucas):**

1. Wait for BLOCK-01 + BLOCK-02 resolution
2. Refer to `test-design-qa.md` for test scenarios
3. Begin with component tests (no blockers) then integration
