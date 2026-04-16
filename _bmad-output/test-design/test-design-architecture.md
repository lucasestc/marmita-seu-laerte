---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-13'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# Test Design for Architecture: Marmita do Seu Laerte — System-Level

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-04-13
**Author:** BMad TEA (Master Test Architect)
**Status:** Architecture Review Pending
**Project:** Marmita do Seu Laerte
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md`

---

## Executive Summary

**Scope:** System-level test design for the full Marmita do Seu Laerte platform — 5 epics, 17 stories, 31 FRs, 19 NFRs. All features are already implemented; this document defines the test strategy to validate the complete system before first customer orders.

**Business Context:**
- **Revenue Impact:** Direct — platform is the only order channel. A broken auth or payment flow = zero revenue.
- **Problem:** Zero test coverage on a fully-implemented production system about to accept real Pix payments.
- **Launch Target:** Pre-launch validation before first flyer distribution.

**Architecture Key Decisions:**
- **Custom WhatsApp OTP auth** via Z-API (no NextAuth) — Z-API is SPOF for both login and all notifications
- **Postgres advisory lock** for concurrent order capacity enforcement (pg_advisory_xact_lock)
- **Manual Pix confirmation** via bidirectional WhatsApp (Laerte sends `PAGO XXXX`) parsed by webhook
- **Next.js proxy pattern** — middleware renamed to `src/proxy.ts` (non-standard Next.js 16 pattern)

**Expected Scale:**
- Max 100 orders/day (hard cap), <100 concurrent users, Vercel free tier

**Risk Summary:**
- **Total risks:** 12 (4 high ≥6, 5 medium 3-5, 3 low 1-2)
- **High-priority requiring immediate mitigation:** 4
- **Test effort:** ~52 scenarios, ~3–5 weeks (1 solo developer acting as QA)

---

## Quick Guide

### 🚨 BLOCKERS — Must Decide Before Production Launch

1. **R-001: Z-API OTP fallback absent** — If Z-API WhatsApp number is banned, users cannot log in at all. SMS fallback (Twilio) is documented as post-MVP but should be stubbed as an env-variable toggle before launch. (Owner: Lucas)
2. **R-002: Concurrent capacity — load test needed** — Advisory lock logic is correct in theory but has never been tested under concurrent load. A load test with simultaneous order placement is required before launch to confirm no race condition escapes the advisory lock. (Owner: Lucas)
3. **R-003: Webhook token in URL query param** — `WEBHOOK_SECRET` is passed as `?token=` which appears in Vercel request logs and Z-API dashboard call history. Should be moved to a request header or at minimum be rotatable. (Owner: Lucas)

### ⚠️ HIGH PRIORITY — Validate Before Launch

1. **R-004: Z-API number ban risk from bulk sends** — Sunday menu reveal sends to ALL consenting customers in parallel. This bulk pattern is the most likely trigger for a WhatsApp number ban via Z-API's unofficial API. Sequential sends with a delay are recommended.
2. **R-008: Session theft has no mitigation** — 30-day HS256 JWT cookies have no refresh, revocation, or rotation mechanism. A stolen cookie is valid for 30 days. Acceptable for MVP but must be documented as a known risk.
3. **R-006: proxy.ts is a non-standard Next.js pattern** — If Next.js upgrades break this, route protection silently fails. This must be regression-tested on every Next.js version bump.

### 📋 INFO ONLY — Solutions Provided

1. **Test strategy:** Vitest (unit/server action) + Playwright (E2E/API integration) — fullstack mix appropriate for this Next.js app
2. **Tooling:** Vitest with @testing-library/react for component tests; Playwright for E2E and API endpoint tests; faker-js for test data
3. **Tiered CI/CD:** PR gate (~15 min), Nightly extended (~30 min), Pre-launch manual E2E
4. **Coverage:** ~52 test scenarios prioritized P0–P3, risk-based
5. **Quality gates:** P0 = 100% pass, P1 = 95% pass, no high-risk items unmitigated

---

## For Architects and Devs — Open Topics

### Risk Assessment

**Total risks identified:** 12 (4 high ≥6, 5 medium 3-5, 3 low 1-2)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **R-001** | **SEC** | Z-API is the sole auth mechanism — number ban or downtime locks ALL users out of login | 2 | 3 | **6** | Implement SMS fallback toggle (Twilio) as env var; graceful error message if Z-API fails OTP send | Lucas | Pre-launch |
| **R-002** | **DATA** | Concurrent order placement race condition — advisory lock is correct but untested under actual concurrent load | 2 | 3 | **6** | Load test with 10 simultaneous requests for the last available slot before launch | Lucas | Pre-launch |
| **R-003** | **SEC** | Webhook secret in URL query param (`?token=`) — visible in Vercel logs, Z-API call history, proxy/CDN access logs | 2 | 3 | **6** | Move to `X-Webhook-Token` request header; rotate current secret immediately after fix | Lucas | Pre-launch |
| **R-004** | **OPS** | Bulk WhatsApp send on Sunday menu reveal sent in parallel to all subscribers — triggers Z-API abuse detection | 2 | 3 | **6** | Migrate to sequential sends with 500ms delay between messages; test with >10 recipients before launch | Lucas | Pre-launch |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-005 | BUS | Pix confirmation is manual (Laerte types `PAGO XXXX`) — typo or wrong ID leaves customer unconfirmed indefinitely | 2 | 2 | 4 | Test regex is case-insensitive, whitespace-tolerant; add clear instructions to Laerte's WhatsApp alert | Lucas |
| R-006 | TECH | `src/proxy.ts` export `proxy` is non-standard Next.js 16 — breaks silently on framework upgrades, unprotecting all routes | 1 | 3 | 3 | Add proxy integration test to PR gate; pin Next.js minor version; regression test on any upgrade | Lucas |
| R-007 | BUS | Capacity display uses `confirmado` only; actual lock uses `!= cancelado` — a day can appear available when all slots are in `aguardando_pagamento` | 2 | 2 | 4 | Document this intentional design; add test verifying full day at `aguardando_pagamento` still rejects new orders | Lucas |
| R-008 | SEC | 30-day HS256 JWT session cookie — no refresh, revocation, or rotation; stolen cookie valid full 30 days | 1 | 3 | 3 | Document as accepted MVP risk; add test verifying cookie is httpOnly + secure + sameSite=strict | Lucas |
| R-009 | OPS | Nightly email fallback is also fire-and-forget — if both Resend and Z-API fail, Laerte has no tomorrow list | 1 | 3 | 3 | Add test verifying fallback WhatsApp is attempted on Resend failure; consider retry logic | Lucas |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-010 | OPS | Brasília UTC offset (UTC-3) is hardcoded in cron schedules — Brazil does not observe DST but Vercel server clocks may drift | 1 | 2 | 2 | Monitor first week's cron fire times; verify `midnight`, `8am`, `1pm`, `8pm` triggers land correctly |
| R-011 | DATA | OTP codes in `otp_codes` table have no scheduled cleanup — table grows unboundedly (low scale, low risk) | 1 | 1 | 1 | Add a weekly cleanup cron or Supabase RLS policy that deletes expired codes older than 24h |
| R-012 | SEC | `SUPABASE_SERVICE_ROLE_KEY` used in cron and admin endpoints — risk of accidental client-side exposure via import leakage | 1 | 2 | 2 | Verify all service role key usages are in server-only files; add `server-only` package import to those files |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### Testability Concerns and Architectural Gaps

#### 🚨 ACTIONABLE CONCERNS — Architecture Team Must Address

| Concern | Impact on Testing | What Architecture Must Provide | Owner | Timeline |
|---------|------------------|-------------------------------|-------|----------|
| **No test environment Z-API isolation** | All tests that touch OTP or notifications will fire real WhatsApp messages unless mocked | Provide `ZAPI_MOCK=true` env flag that stubs `sendMessage()` to a noop/logger in test environment | Lucas | Before test suite setup |
| **No test data seeding API** | Tests must insert rows directly into Supabase — coupling tests to DB schema details | Either expose a `/api/test/seed` endpoint (protected, test-env only) or document the minimal SQL fixture scripts | Lucas | Before integration tests |
| **Vercel Cron routes not testable via Playwright without auth** | Cron endpoints require `Authorization: Bearer <CRON_SECRET>` — need to confirm this is configurable in test env | Document how to invoke cron routes in tests (direct fetch with `CRON_SECRET` in header) | Lucas | Before cron tests |
| **`src/proxy.ts` export name** | If proxy is silently bypassed in test environment (e.g., different entrypoint), protected routes appear open | Explicitly test that proxy runs in the test environment by hitting `/order` unauthenticated and expecting a redirect | Lucas | P0 test priority |

#### 2. Architectural Improvements Needed

1. **Z-API mock injection for tests**
   - **Current problem:** `sendMessage()` in `src/lib/zapi.ts` calls Z-API REST API directly with no injection point
   - **Required change:** Add `ZAPI_MOCK=true` env flag that replaces `sendMessage` with a no-op logger; or wrap in an interface injectable in tests
   - **Impact if not fixed:** Every test that triggers auth or notifications sends real WhatsApp messages — test runs spam Laerte and customers
   - **Owner:** Lucas
   - **Timeline:** Before any integration test is written

2. **Sequential sends in Sunday menu reveal**
   - **Current problem:** `menu-reveal` cron sends parallel WhatsApp messages to all subscribers
   - **Required change:** Convert to sequential sends with 500ms delay (or use a queue)
   - **Impact if not fixed:** Z-API number ban risk (R-004) — complete loss of the auth + notification channel
   - **Owner:** Lucas
   - **Timeline:** Pre-launch

---

### Testability Assessment Summary

#### What Works Well

- ✅ **Server Actions return `{ success, error }` — never throw** — deterministic response shapes make unit testing straightforward
- ✅ **All external inputs validated with Zod** — validation layer is well-separated and unit-testable without DB
- ✅ **Postgres advisory lock is a single, isolated RPC** — `place_order` RPC can be integration-tested independently
- ✅ **Webhook handler is a plain Next.js Route Handler** — testable via direct HTTP calls with controlled payload
- ✅ **Cron jobs are protected HTTP endpoints** — can be invoked directly in tests with `CRON_SECRET` bearer token
- ✅ **Route protection in `proxy.ts` has clear redirect behavior** — testable with unauthenticated requests

#### Accepted Trade-offs (No Action Required)

For Marmita do Seu Laerte MVP, the following trade-offs are acceptable:

- **No Supabase emulator in CI** — Tests run against a real Supabase test project; slower but more reliable than emulated DB
- **No Mercado Pago/real payment gateway** — Pix flow is currently manual key generation; no payment SDK to mock
- **No performance testing suite** — Scale is <100 orders/day; k6 or similar load testing is post-MVP

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

#### R-001: Z-API OTP SPOF (Score: 6) — LAUNCH BLOCKER

**Mitigation Strategy:**
1. Add `ZAPI_MOCK=true` environment variable to test and staging configs — prevents real WhatsApp sends during tests
2. In `src/lib/zapi.ts`, check `process.env.ZAPI_MOCK` — if set, log the message and return `{ success: true }` without calling Z-API
3. Document in runbook: if Z-API is banned in production, customer-facing error should read "Não foi possível enviar o código. Tente novamente em alguns minutos." — never expose the word "Z-API"
4. Post-MVP: add `ZAPI_FALLBACK_SMS=twilio` toggle that routes OTP sends to Twilio SMS if Z-API fails

**Owner:** Lucas
**Timeline:** Pre-launch
**Status:** Planned
**Verification:** Integration test verifies OTP send failure returns a user-friendly Portuguese error, not a 500

#### R-002: Concurrent Order Capacity Race (Score: 6) — LAUNCH BLOCKER

**Mitigation Strategy:**
1. Write a concurrent load test: 10 simultaneous POST requests to the `place_order` server action for the same date with only 1 slot remaining
2. Verify exactly 1 succeeds (gets `display_id`) and 9 fail with capacity error
3. The advisory lock (`pg_advisory_xact_lock`) should handle this — test confirms it in practice, not just theory
4. Run this test against the real Supabase DB (not a mock) — advisory locks are DB-level behavior

**Owner:** Lucas
**Timeline:** Pre-launch
**Status:** Planned
**Verification:** Concurrent test passes consistently (run 5 times, no race through)

#### R-003: Webhook Secret in URL (Score: 6) — LAUNCH BLOCKER

**Mitigation Strategy:**
1. Move webhook validation from `?token=WEBHOOK_SECRET` to `X-Webhook-Token: WEBHOOK_SECRET` request header
2. Update Z-API webhook configuration to send the header
3. Rotate `WEBHOOK_SECRET` after the change is deployed
4. Add test: request without header → 401; request with wrong header value → 401; correct value → 200

**Owner:** Lucas
**Timeline:** Pre-launch
**Status:** Planned
**Verification:** Unit test on webhook handler validates header-based auth; old `?token=` param no longer accepted

#### R-004: Z-API Number Ban from Bulk Sends (Score: 6) — LAUNCH BLOCKER

**Mitigation Strategy:**
1. In `menu-reveal` cron (`/api/cron/menu-reveal`), change from `Promise.all()` sends to sequential loop with 500ms delay between each message
2. Apply same pattern to `morning-story` and `rating-prompt` crons if they send to >10 recipients
3. Test that sequential sending still completes within the 5-minute Vercel cron timeout for realistic recipient counts (up to 100)
4. Add logging: log send count and total duration at end of each cron job

**Owner:** Lucas
**Timeline:** Pre-launch
**Status:** Planned
**Verification:** Cron test with 20 mock recipients completes without timeout; sequential order confirmed in logs

---

### Assumptions and Dependencies

#### Assumptions

1. Tests run against a dedicated Supabase **test project** (not the production DB) — separate `SUPABASE_URL` and keys for test env
2. Z-API sends are mocked in test environment via `ZAPI_MOCK=true` — no real WhatsApp messages during CI
3. Vercel cron jobs are tested by direct HTTP invocation with `CRON_SECRET` header — not by waiting for scheduled fires
4. Resend email is mocked in test environment (Resend sandbox mode or `RESEND_MOCK=true` equivalent)

#### Dependencies

1. **Supabase test project provisioned** — separate from production, with same schema migrations applied
2. **`ZAPI_MOCK` env var implemented** — required before any integration test that touches auth or notifications
3. **Test environment `.env.test`** file documented — all required env vars with test values

#### Risks to Plan

- **Risk:** Single developer (Lucas) is both implementer and tester — test coverage may be deprioritized under time pressure
  - **Impact:** Critical flows (concurrent capacity, webhook auth) could go untested to launch
  - **Contingency:** Prioritize P0 tests only for launch; defer P1–P3 to post-launch sprint

---

**End of Architecture Document**

**Next Steps for Architecture/Dev (Lucas):**
1. Implement `ZAPI_MOCK=true` flag in `src/lib/zapi.ts` before writing any tests
2. Move webhook secret to request header (R-003 fix)
3. Sequential-ize Sunday menu reveal sends (R-004 fix)
4. Run concurrent capacity load test (R-002 validation)

**Next Steps for QA:**
1. Set up Supabase test project and `.env.test` config
2. Install Vitest + Playwright
3. Refer to `test-design-qa.md` for the full scenario list
