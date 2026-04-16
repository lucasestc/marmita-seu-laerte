---
lastSaved: '2026-04-13'
workflowType: 'testarch-test-design-handoff'
---

# Test Design Handoff — Marmita do Seu Laerte

**Purpose:** Quick-reference handoff connecting test design decisions to stories and implementation priorities.

---

## TEA Artifacts Inventory

| Document | Path | Purpose |
|----------|------|---------|
| Architecture Test Design | `_bmad-output/test-design/test-design-architecture.md` | Testability concerns, risk register, architectural blockers |
| QA Test Design | `_bmad-output/test-design/test-design-qa.md` | Full scenario list (52 tests), tooling setup, execution strategy |
| Progress Tracker | `_bmad-output/test-design/test-design-progress.md` | Workflow completion state |

---

## Pre-Test Architecture Work Required

These **must be completed before any test is written** (each is ~1–4 hours of work):

| Fix | File | Effort | Blocks |
|-----|------|--------|--------|
| Add `ZAPI_MOCK=true` flag to `sendMessage()` | `src/lib/zapi.ts` | ~2h | Every auth + notification test |
| Move webhook token from `?token=` to `X-Webhook-Token` header | `src/app/api/webhooks/zapi/route.ts` | ~2h | P0-011 |
| Sequentialize Sunday menu reveal sends (500ms delay) | `src/app/api/cron/menu-reveal/route.ts` | ~1h | P1-015, launch safety |
| Provision Supabase test project, create `.env.test` | — | ~2h | All integration tests |

---

## Critical Risks → Story Mapping

| Risk | Score | Fix Sprint | Test |
|------|-------|------------|------|
| R-001: Z-API OTP SPOF | 6 | Pre-launch | P0-001, P0-002 |
| R-002: Concurrent capacity race | 6 | Pre-launch | P0-010 |
| R-003: Webhook token in URL | 6 | Pre-launch | P0-011 |
| R-004: Bulk WhatsApp ban risk | 6 | Pre-launch | P1-015 |

---

## Test Sprint Plan

### Sprint 1 — P0 (Launch gate)
Focus: auth flow, order placement, concurrent capacity, webhook auth, route protection

Key files to create:
- `src/actions/auth.test.ts` — OTP unit tests
- `src/actions/orders.test.ts` — order unit tests
- `tests/e2e/auth.spec.ts` — route protection E2E
- `tests/api/webhook.spec.ts` — PAGO parsing + header auth
- `tests/concurrent/capacity.spec.ts` — race condition

**Definition of done:** All 14 P0 tests green in CI on every PR.

### Sprint 2 — P1 (Pre-launch full coverage)
Focus: Pix flow, admin, crons, ratings, notifications

Key files to create:
- `tests/e2e/checkout.spec.ts` — Pix expiry, regeneration, cancellation
- `tests/e2e/menu.spec.ts` — public menu, admin management
- `tests/api/cron.spec.ts` — all 4 cron jobs
- `src/actions/ratings.test.ts` — rating submission

**Definition of done:** All 32 P0+P1 tests green; R-001–004 mitigations verified.

### Sprint 3 / Post-Launch — P2+P3
Focus: edge cases, accessibility, regression hardening

---

## Quality Gate for Launch

Before accepting first real customer order:

- [ ] All P0 tests passing
- [ ] R-003 fix deployed (webhook header auth)
- [ ] R-004 fix deployed (sequential menu reveals)
- [ ] `ZAPI_MOCK=true` confirmed NOT set in production environment
- [ ] Manual full Ana journey smoke test on staging: OTP → order → Pix → PAGO webhook → confirmation → 1pm rating prompt
