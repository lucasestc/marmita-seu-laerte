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

# Test Design for QA: Marmita do Seu Laerte

**Purpose:** Test execution recipe. Defines what to test, how to test it, and what Lucas needs to unblock before proceeding.

**Date:** 2026-04-12
**Author:** BMad Test Architect (automated)
**Status:** Draft
**Project:** Marmita do Seu Laerte

**Related:** See `test-design-architecture.md` for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** All 5 epics (17 stories) — authentication, public menu, ordering & Pix, WhatsApp notifications, ratings & LGPD.

**Risk Summary:**

- Total Risks: 12 (4 high-priority ≥6, 4 medium 4–5, 4 low 1–3)
- Critical Categories: SEC (R03, R08 — auth bypass, admin guard), DATA (R04 — concurrent capacity), OPS (R06 — Z-API SPOF)

**Coverage Summary:**

- ✅ Already written: 44 tests (unit: 30, component: 14)
- P0 tests to write: ~14 (OTP security, concurrency, Z-API failure, admin guard)
- P1 tests to write: ~20 (webhook, cancel/slot, component flows)
- P2 tests to write: ~10 (FR sweep, menu CRUD)
- P3 tests to write: ~5 (E2E + perf)
- **Total new:** ~49 tests
- **Time estimate:** ~43–77 hours (solo, Lucas)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|-----------|
| **Mercado Pago integration** | Phase 2 only; not implemented | Manual testing at Phase 2 integration |
| **VR credenciamento / physical maquininha** | Offline hardware payment; no app surface | Ops validation by Laerte |
| **MEI registration / CNAE compliance** | Administrative, not technical | Manual validation with contador |
| **WhatsApp number ban scenario** | Z-API external dependency; can't test | Mitigated by low-volume, opt-in messaging |
| **Browser visual regression** | No Playwright in current stack | Manual cross-browser smoke test |
| **Performance benchmarks (NFR1–4)** | Requires load testing infrastructure | Deferred to P3 / post-launch |

---

## Dependencies & Test Blockers

**CRITICAL: These must be resolved before integration tests can begin.**

### Backend/Architecture Dependencies (Pre-Implementation)

1. **BLOCK-01: Mock seam for `sendMessage()` (Z-API)** — Lucas — Sprint start
   - Need: `vi.mock('@/lib/zapi')` to work, or an exported test double.
   - Blocks: AUTH-API-001–003, ORDER-API-001–003, ZAPI-API-001–002.

2. **BLOCK-02: Supabase test project with full schema** — Lucas — Sprint start
   - Need: `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` env vars.
   - All migrations from `supabase/migrations/` applied.
   - Blocks: all integration tests touching the DB.

### QA Infrastructure Setup

1. **Test Data Helpers** — create `src/__tests__/helpers/db.ts`:
   - `seedOtpCode(phone, expiresAt?, usedAt?)` — inserts `otp_codes` row directly via Supabase service client
   - `seedOrder(overrides?)` — inserts `orders` row with `display_id`, `status`, `delivery_date`
   - `seedCustomer(phone?)` — inserts `customers` row
   - `cleanupPhone(phone)` — deletes all test data for a phone number
   - Use `faker` for phone numbers to ensure parallel-safety

2. **Test Environments**:
   - Local: `.env.test` with Supabase test project vars + `SESSION_SECRET=test-secret-32-chars-min`
   - CI: GitHub Actions with test env vars from Secrets
   - No staging environment required for MVP (solo project)

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|-----------------|
| **R03** | SEC | OTP bypass via expired/reused codes | **6** | AUTH-API-001 (expired), AUTH-API-002 (reused) |
| **R04** | DATA | Concurrent placeOrder oversells last slot | **6** | ORDER-API-003 (concurrent Promise.all) |
| **R06** | OPS | Z-API down breaks OTP auth | **6** | ZAPI-API-002 (mock failure → graceful error) |
| **R08** | SEC | Admin guard bypass (/admin/* non-Laerte) | **6** | ADMIN-API-001 (proxy), ADMIN-API-002 (assertAdmin) |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|-----------------|
| R05 | BUS | PAGO webhook duplicate confirmation | 4 | WEBHOOK-API-002 (idempotency) |
| R07 | TECH | Pix countdown clock skew | 4 | COMP-UNIT-008–014 (done) |
| R11 | BUS | Midnight cutoff timezone edge | 4 | ORDER-API-006 (past date rejected) |
| R12 | BUS | Slot not restored after cancel | 4 | ORDER-API-004–005 |
| R01 | TECH | normalisePhone strips + (fixed) | 3 | LIB-UNIT-023–030 (done) |
| R02 | TECH | nextMondayFrom weekday (fixed) | 2 | LIB-UNIT-001–022 (done) |
| R09 | SEC | Session JWT forgery | 3 | Architectural guarantee — no test needed |
| R10 | OPS | tomorrowBrasilia date error (fixed) | 2 | LIB-UNIT tests (done) |

---

## Entry Criteria

- [ ] BLOCK-01 resolved: `vi.mock('@/lib/zapi')` functional
- [ ] BLOCK-02 resolved: Supabase test project accessible with full schema
- [ ] `.env.test` documented and populated with test credentials
- [ ] `src/__tests__/helpers/db.ts` test data helpers written
- [ ] All existing 44 tests continue to pass (`npm test`)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (≥95%)
- [ ] 4 MITIGATE risks (R03, R04, R06, R08) each have ≥1 green test
- [ ] No unhandled promise rejections or console errors in test output
- [ ] `npm test` completes in < 5 minutes

---

## Project Team

| Name | Role | Testing Responsibilities |
|------|------|--------------------------|
| Lucas | Dev + QA (solo) | All test implementation, infrastructure setup, review |

---

## Test Coverage Plan

### P0 — Critical (14 tests to write + 44 already done)

**Criteria:** MITIGATE risks (score ≥6) + auth security + capacity integrity

| Test ID | Scenario | Level | Risk | FR/NFR |
|---------|----------|-------|------|--------|
| **P0-001** | OTP expired (> 10 min): `verifyOtp` returns `{ success: false }` | Integration | R03 | NFR7 |
| **P0-002** | OTP already-used (`used_at` set): `verifyOtp` returns `{ success: false }` | Integration | R03 | NFR7 |
| **P0-003** | OTP valid: `verifyOtp` creates session, sets cookie, redirects | Integration | — | FR1, FR3 |
| **P0-004** | `placeOrder` at slot 99: succeeds | Integration | R04 | FR13 |
| **P0-005** | `placeOrder` at slot 100: returns capacity error | Integration | R04 | FR13 |
| **P0-006** | Two simultaneous `placeOrder` calls for last slot: only 1 wins | Integration | R04 | NFR13 |
| **P0-007** | `sendMessage` throws: `requestOtp` returns graceful error (no crash) | Integration | R06 | NFR10, NFR14 |
| **P0-008** | `sendMessage` throws: `placeOrder` still completes (fire-and-forget) | Integration | R06 | NFR14 |
| **P0-009** | GET /admin/menu with non-Laerte JWT: proxy redirects to / | Integration | R08 | — |
| **P0-010** | Admin server action with non-Laerte JWT: `assertAdmin()` returns error | Integration | R08 | — |
| **P0-011** | OtpInput: 6 boxes auto-advance on digit entry | Component | — | FR1, NFR18 |
| **P0-012** | OtpInput: backspace navigates to previous box | Component | — | FR1 |
| **P0-013** | OtpInput: paste fills all 6 boxes | Component | — | FR1 |
| **P0-014** | LoginFlow: shows error when OTP verify fails | Component | R03 | FR1 |

*Already written (not re-listed): LIB-UNIT-001–030 (unit), COMP-UNIT-001–014 (component)*

**Total P0:** 14 new + 44 existing = **58 tests**

---

### P1 — High Priority (20 tests)

**Criteria:** Critical user flows, MONITOR risks, webhook security

| Test ID | Scenario | Level | Risk | FR/NFR |
|---------|----------|-------|------|--------|
| **P1-001** | POST /api/webhooks/zapi: valid PAGO from Laerte → order `confirmado` | Integration | — | FR19 |
| **P1-002** | POST /api/webhooks/zapi: PAGO for already-confirmed order → 200, no resend | Integration | R05 | NFR16 |
| **P1-003** | POST /api/webhooks/zapi: PAGO from non-Laerte phone → 200, ignored | Integration | — | — |
| **P1-004** | POST /api/webhooks/zapi: wrong/missing `?token` → 401 | Integration | — | — |
| **P1-005** | POST /api/webhooks/zapi: unknown `display_id` → 200, logged | Integration | NFR16 | — |
| **P1-006** | `cancelOrder`: cancels `aguardando_pagamento` order, slot restored | Integration | R12 | FR11 |
| **P1-007** | `cancelOrder`: rejects cancel on `confirmado` order | Integration | R12 | FR12 |
| **P1-008** | `placeOrder`: rejected for today (cutoff) | Integration | R11 | FR14 |
| **P1-009** | `renewPixExpiry`: non-`aguardando_pagamento` order rejected | Integration | — | FR18 |
| **P1-010** | `renewPixExpiry`: extends `pix_expires_at` by 30 min | Integration | — | FR18 |
| **P1-011** | GET /api/cron/* without `Authorization: Bearer` → 401 | Integration | — | — |
| **P1-012** | GET /api/cron/nightly-email: valid auth → 200, no crash | Integration | — | FR25 |
| **P1-013** | `submitRating`: inserts row, returns `{ success: true }` | Integration | — | FR31 |
| **P1-014** | `submitRating`: duplicate → "Você já avaliou este pedido." (Postgres 23505) | Integration | — | FR31 |
| **P1-015** | CancelOrderButton: first tap shows confirm row, second tap fires action | Component | — | FR11 |
| **P1-016** | CancelOrderButton: success calls `onCancelled` | Component | — | FR11 |
| **P1-017** | PixSection: renders active Pix state (not expired) | Component | — | FR15 |
| **P1-018** | PixSection: shows regenerate button after `onExpire` fires | Component | — | FR18 |
| **P1-019** | RatingForm: star selection updates display, submit calls action | Component | — | FR31 |
| **P1-020** | RatingForm: success message displayed after submit | Component | — | FR31 |

**Total P1:** 20 tests

---

### P2 — Medium (10 tests)

**Criteria:** Secondary flows, FR coverage, regression prevention

| Test ID | Scenario | Level | FR |
|---------|----------|-------|----|
| **P2-001** | DeletionRequestButton: two-step confirm flow, success message | Component | FR30 |
| **P2-002** | CopyPixButton: calls `navigator.clipboard.writeText`, shows "Copiado!" | Component | FR16 |
| **P2-003** | `createMenuWeek`: inserts week + items, returns success | Integration | FR7 |
| **P2-004** | `createMenuWeek`: duplicate `week_start` → Portuguese error message | Integration | FR7 |
| **P2-005** | `updateMenuItem`: updates `name`, `description`, `morning_message` | Integration | FR7, FR26 |
| **P2-006** | Phone entry form: LGPD checkbox must be checked before submit | Component | FR28 |
| **P2-007** | `placeOrder`: unauthenticated (no session cookie) → redirect to /login | Integration | FR9 |
| **P2-008** | `requestDeletion`: returns `{ success: true }` even if Resend fails | Integration | FR30 |
| **P2-009** | `updateMorningMessage`: persists morning_message to DB | Integration | FR26 |
| **P2-010** | GET /api/cron/menu-reveal: no next-week menu → 200 with empty message count | Integration | FR20 |

**Total P2:** 10 tests

---

### P3 — Low Priority / Future (5 tests)

**Criteria:** E2E journeys (require Playwright), performance

| Test ID | Scenario | Level | Notes |
|---------|----------|-------|-------|
| **P3-001** | Ana happy path: login → order → checkout → order status | E2E | Requires Playwright + running app |
| **P3-002** | Pix expiry → regenerate → view updated countdown | E2E | Requires Playwright |
| **P3-003** | Capacity lock: order attempt when day is full → "Esgotado" | E2E | Requires Playwright |
| **P3-004** | Admin: create menu week → verify public menu page updates | E2E | Requires Playwright |
| **P3-005** | Public menu page LCP < 2.5s on throttled connection | Perf | Requires Lighthouse CI |

**Total P3:** 5 tests (deferred — Playwright not yet set up)

---

## Execution Strategy

| Trigger | Suite | Tool | Max Time |
|---------|-------|------|----------|
| Every PR | All unit + component tests (P0+P1 subset) | Vitest | < 2 min |
| Every PR | Integration tests (P0+P1) — when Supabase test env ready | Vitest | < 5 min |
| Nightly | Full P0–P2 suite | Vitest | < 15 min |
| Weekly | E2E + Lighthouse (P3) | Playwright + Lighthouse CI | 30–60 min |

**Tagging convention** (for selective runs):
```bash
# Run only P0 integration tests
npx vitest run --reporter=verbose src/__tests__/integration/auth

# Watch mode during development
npm run test:watch
```

---

## QA Effort Estimate

| Priority | Count (new) | Effort Range | Notes |
|----------|-------------|--------------|-------|
| P0 | 14 | ~12–20 hrs | OTP integration requires Supabase test project |
| P1 | 20 | ~10–18 hrs | Webhook tests straightforward with mock sendMessage |
| P2 | 10 | ~5–10 hrs | Component tests fast; integration needs DB helpers |
| P3 | 5 | ~10–20 hrs | Playwright setup dominates estimate |
| **Total** | **49** | **~37–68 hrs** | Solo developer (Lucas), part-time test development |

**Assumptions:**
- BLOCK-01 + BLOCK-02 resolved before integration sprint starts
- Existing 44 tests remain green throughout (< 30 min regression check)
- E2E (P3) deferred until after first paying customer week

---

## Implementation Planning Handoff

| Work Item | Owner | Phase | Dependencies |
|-----------|-------|-------|--------------|
| Add mock seam to `src/lib/zapi.ts` (BLOCK-01) | Lucas | Before integration sprint | — |
| Provision Supabase test project + apply migrations (BLOCK-02) | Lucas | Before integration sprint | — |
| Create `.env.test.example` documenting test env vars | Lucas | Before integration sprint | — |
| Write `src/__tests__/helpers/db.ts` test data helpers | Lucas | Integration sprint start | BLOCK-02 |
| Write P0 OTP integration tests (P0-001–003) | Lucas | Integration sprint | BLOCK-01 + BLOCK-02 |
| Write P0 capacity concurrency test (P0-006) | Lucas | Integration sprint | BLOCK-02 + migrations |
| Write P0 admin guard tests (P0-009–010) | Lucas | Integration sprint | BLOCK-01 + BLOCK-02 |
| Write P1 webhook integration tests (P1-001–005) | Lucas | Integration sprint | BLOCK-01 + BLOCK-02 |
| Write remaining P1 component tests (P1-015–020) | Lucas | Any time (no blockers) | — |
| Write P2 tests | Lucas | Post-integration sprint | — |
| Playwright setup + P3 E2E | Lucas | Post-first-customer-week | — |

---

## Tooling & Access

| Tool / Service | Purpose | Status |
|----------------|---------|--------|
| Vitest 4.x | Unit + Component + Integration test runner | ✅ Installed |
| @testing-library/react | Component tests (RTL) | ✅ Installed |
| @testing-library/user-event | User interaction simulation | ✅ Installed |
| @testing-library/jest-dom | DOM matchers | ✅ Installed |
| jsdom | DOM environment for Vitest | ✅ Installed |
| Supabase test project | Real Postgres for integration tests | ⏳ Pending (BLOCK-02) |
| Playwright | E2E tests (P3) | ⏳ Not yet installed |
| Lighthouse CI | LCP performance test (P3) | ⏳ Not yet installed |
| faker-js | Unique test data generation | ⏳ Not yet installed — add with `npm install -D @faker-js/faker` |

---

## Interworking & Regression

| Component | Impact | Regression Scope | Validation |
|-----------|--------|-----------------|------------|
| `src/lib/date-helpers.ts` | Date logic used by 5 files | 22 unit tests | `npm test` |
| `src/lib/phone-helpers.ts` | Phone normalization (auth + webhook) | 8 unit tests | `npm test` |
| `src/proxy.ts` | Route protection (auth + admin guard) | Proxy integration tests (P0-009) | Integration run |
| `/api/webhooks/zapi` | Pix confirmation, PAGO parsing | Webhook integration tests (P1-001–005) | Integration run |
| `/api/cron/*` | 4 scheduled jobs | Cron smoke tests (P1-011–012) | Nightly |

**Regression strategy:**

- `npm test` must be green before any merge to main
- P0 + P1 integration suite must be green before production deploy
- P3 E2E smoke (Ana happy path) must be green before post-MVP releases

---

## Appendix: Test File Structure

Recommended file layout for new tests:

```
src/__tests__/
  setup.ts                          # jest-dom imports
  helpers/
    db.ts                           # Supabase test data helpers (seed/cleanup)
    session.ts                      # forge JWT session cookies for tests
  lib/
    date-helpers.test.ts            # ✅ done
    phone-helpers.test.ts           # ✅ done
  components/
    StarRating.test.tsx             # ✅ done
    CountdownTimer.test.tsx         # ✅ done
    OtpInput.test.tsx               # P0-011–013
    CancelOrderButton.test.tsx      # P1-015–016
    PixSection.test.tsx             # P1-017–018
    RatingForm.test.tsx             # P1-019–020 (partially done)
    DeletionRequestButton.test.tsx  # P2-001
    CopyPixButton.test.tsx          # P2-002
  integration/
    auth/
      verify-otp.test.ts            # P0-001–003
      request-otp.test.ts           # P0-007
    orders/
      place-order.test.ts           # P0-004–006, P1-008
      cancel-order.test.ts          # P1-006–007
      renew-pix.test.ts             # P1-009–010
    ratings/
      submit-rating.test.ts         # P1-013–014
      request-deletion.test.ts      # P2-008
    admin/
      guard.test.ts                 # P0-009–010
      menu.test.ts                  # P2-003–005, P2-009
    webhooks/
      zapi.test.ts                  # P1-001–005
    cron/
      nightly-email.test.ts         # P1-012
      menu-reveal.test.ts           # P2-010
  e2e/                              # P3 — Playwright (future)
    ana-happy-path.spec.ts
    pix-expiry-flow.spec.ts
    capacity-lock.spec.ts
```

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** System-Level Mode, Sequential Execution
