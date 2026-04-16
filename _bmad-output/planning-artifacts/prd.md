---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments: ['_bmad-output/brainstorming/brainstorming-session-2026-03-30-1.md']
brainstormingCount: 1
briefCount: 0
researchCount: 0
projectDocsCount: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low-medium
  projectContext: greenfield
---

# Product Requirements Document - Marmita do Seu Laerte

**Author:** Lucas
**Date:** 2026-04-01

## Executive Summary

**Marmita do Seu Laerte** is a web-based meal ordering platform delivering home-cooked Brazilian comfort food to corporate workers in Faria Lima, São Paulo. Workers in one of Brazil's most expensive business districts spend R$45–120 on lunch daily — waiting in queues, making decisions, and rarely loving the result. The platform enables customers to order a daily marmita prepared by Seu Laerte — a home cook with 40+ years of experience — picked up at their building lobby at 11:45am, at R$35–40 per order (or R$28–30/day on a subscription plan, post-MVP).

### What Makes This Special

The product's core differentiator is human and irreplicable: Seu Laerte himself. His face IS the brand — every interaction, from the Sunday menu reveal to the lobby pickup, centers on a specific person with a specific history. No startup can manufacture that. The discovery moment happens at the lobby, where workers encounter colleagues picking up their marmita; the delight moment is first bite. The platform's role is to make ordering frictionless and amplify that emotional bond through thoughtful touchpoints (WhatsApp notifications, daily dish stories, 1-tap ratings). The moat is not the technology — it's the cook, the recipes, and the trust that builds meal by meal.

## Project Classification

- **Project Type:** Web application (Next.js full-stack, browser-based)
- **Domain:** Food delivery / meal ordering
- **Complexity:** Low-Medium — Next.js + Supabase stack with WhatsApp automation (Z-API) and custom OTP authentication
- **Project Context:** Greenfield — new project, no existing codebase

## Success Criteria

### User Success
- Customer completes first order end-to-end (web app → WhatsApp Pix confirmation) in under 3 minutes
- ≥ 80% of Week 1 customers return in Week 2 — indicates price + experience satisfaction
- Morning dish notifications are regularly opened — signals emotional engagement
- Average meal rating ≥ 4.5 stars — proxy for "price + needs being met" satisfaction

### Business Success
- **Week 1:** 10 paying customers — validates demand and ops flow
- **Month 3:** 50 marmitas/day — half capacity, unit economics confirmed
- **Fully booked:** 100 marmitas/day — Laerte's physical ceiling, triggers scale conversation
- Zero food waste: production matches orders daily (direct result of pre-order model)
- **MEI milestone:** At ~10/day, annual revenue approaches R$81k MEI ceiling. Plan MEI → ME transition before Month 3.

### Technical Success
- WhatsApp OTP: zero failed sends under normal conditions
- Web app fully functional on mobile
- Z-API notifications fire correctly on all scheduled triggers
- Pix checkout generates a valid key; customer receives WhatsApp confirmation after payment
- Supabase sessions persist 30 days without re-auth

### Measurable Outcomes

| Milestone | Target |
|---|---|
| Week 1 daily orders | 10 |
| Month 3 daily orders | 50 |
| Fully booked | 100 |
| Week 2 retention | ≥ 80% |
| Average rating | ≥ 4.5 stars |
| Order completion time | < 3 min |

## User Journeys

### Journey 1: Ana — The Convert (Customer Happy Path)

Ana, 28, is a financial analyst at an asset management firm in Faria Lima. She spends R$65–80 on lunch most days — waiting 20 minutes at a kilo restaurant or settling for something mediocre. She doesn't love it. She just doesn't think there's a better option.

**Opening Scene:** On a Tuesday, she notices a colleague holding a marmita in the lobby. The smell hits her first. He shows her the flyer. She scans the QR code.

**Rising Action:** The web app opens on her phone. She sees the week's menu — five dishes described with care, prices clear. She taps "Fazer pedido" for Thursday's escondidinho. The app asks for her phone number. She types it. A WhatsApp message arrives: "Seu código de acesso: 382910." She types it in. She's logged in.

She reaches the checkout screen. A Pix key appears with the amount and a 30-minute window to pay. She opens her bank app, pays, and seconds later gets a WhatsApp message: "Pedido confirmado! Quinta-feira, 11h45 no lobby. Até lá! 🍱 — Seu Laerte"

**Climax:** Thursday at 11:45am she goes down. Seu Laerte is there, thermal bag open, list in hand. "Ana?" He hands it over with a smile. She eats at her desk. First bite. It tastes like her mãe's frango assado. She finishes every grain of rice.

At 1pm her phone buzzes: "Como foi o almoço hoje? 🍽️" One tap. Five stars.

**Resolution:** By Friday she's already ordered Monday. By Week 3, she doesn't think about lunch anymore. She tells two colleagues. Both scan the QR code still in her phone photos.

**Capabilities revealed:** Phone OTP auth, menu display, order flow, Pix checkout, WhatsApp order confirmation, 1pm rating notification.

---

### Journey 2: Rafael — The Almost Customer (Edge Case)

Rafael, 34, is a lawyer at a Faria Lima firm. Interested but impatient — if something doesn't work first try, he moves on.

**Opening Scene:** He scans the flyer Monday evening from home, decides to order for Wednesday.

**Rising Action:** He enters his phone number. The OTP doesn't arrive in 30 seconds. He taps "Reenviar código." The second message arrives — he logs in.

He picks Wednesday's dish, sees the Pix key, then a call interrupts. An hour later the Pix key is expired. The app shows "aguardando pagamento" with a "Gerar novo Pix" button. He taps it, pays immediately.

Wednesday morning the dish story notification arrives. He'd forgotten — the reminder is welcome. Picks up at 11:45am, eats, rates 4 stars (he wanted more farofa).

**Resolution:** He orders again the following week. The first-order friction fades. He never had to contact anyone.

**Capabilities revealed:** OTP resend, Pix expiry + regeneration, order status tracking ("aguardando pagamento"), pre-payment cancellation (slot released), morning notification as re-engagement nudge.

---

### Journey 3: Seu Laerte — The Morning Before Delivery (Ops Journey)

Laerte, 60s, is the cook and the brand. Reliable and detail-oriented — if the list says 23 marmitas, he makes 23.

**Opening Scene:** Tuesday night, an email arrives at midnight: "Pedidos para amanhã — Quarta-feira, 5 de Abril." Attached: an Excel file.

**Rising Action:** Wednesday morning over coffee, he opens the spreadsheet: name, phone, order details. 18 orders. He writes 18 on a Post-it and goes to the market with his shopping list, quantities already calculated per recipe.

He cooks all morning — no guessing, no waste. At 11:30am he packs the thermal bag, checks the list, heads to the building. At 11:45am he's in the lobby, calling names from the list. Each handoff takes 20 seconds.

**Climax:** A walk-in approaches — not on the list. He's fully booked. He takes their number. That night, a new WhatsApp order alert arrives.

**Resolution:** Back home by 1pm. Three new order alerts during the morning. He knows tomorrow's count will be higher.

**Capabilities revealed:** Nightly automated email with Excel order list, WhatsApp new order alert to Laerte, midnight order cutoff, per-day count enabling zero-waste production.

---

### Journey 4: Camila — The Locked Out (Capacity Edge Case)

Camila opens the app Tuesday evening to order Wednesday. She taps "Fazer pedido" — **"Esgotado para quarta-feira. O Seu Laerte já tem 100 pedidos para esse dia."** She checks Thursday — available. Orders Thursday, pays, gets confirmation.

**Capabilities revealed:** Per-day order counter, capacity lock at 100, "esgotado" state on menu/order screen, available days clearly shown.

---

### Journey Requirements Summary

| Capability | Revealed By |
|---|---|
| Phone number + WhatsApp OTP auth (with resend) | Ana, Rafael |
| Weekly menu display with per-day availability status | Ana, Rafael, Camila |
| Order flow with dish selection | Ana, Rafael |
| Pix checkout with expiry + regeneration | Ana, Rafael |
| Cancellation before payment (slot released); locked after payment | Rafael |
| WhatsApp order confirmation to customer | Ana |
| WhatsApp new order alert to Laerte | Laerte |
| 1pm rating prompt via WhatsApp | Ana |
| Sunday menu reveal via WhatsApp | Ana |
| Morning dish story notification | Rafael |
| Order status tracking ("aguardando pagamento") | Rafael |
| Per-day capacity counter (max 100, locks at limit) | Camila |
| "Esgotado" day state on menu/order screen | Camila |
| Order cutoff at midnight (previous day) | Laerte |
| Nightly automated email to Laerte (Excel: name, phone) | Laerte |
| **[Phase 2]** Paid order postponement to available date | Future |

## Domain-Specific Requirements

### Compliance & Regulatory (LGPD)

- Explicit opt-in consent for WhatsApp notifications required at signup
- Privacy policy page linked at signup; data retained indefinitely
- Customer data deletion handled manually by Lucas/Laerte upon request (not self-serve in MVP)
- No PCI-DSS obligations in MVP — Pix payment occurs in the customer's own bank app; platform generates the key only

### Technical Constraints

- Z-API runs on WhatsApp Web automation (not official Business API) — number ban risk if messages appear spammy. Mitigated by low volume, opt-in users, and conversational message tone.
- SMS fallback OTP (Twilio) is a post-MVP risk mitigation if Z-API number is banned.

### Integration Requirements

- Pix via manual key generation in MVP. Mercado Pago integration deferred to Phase 2.
- Z-API handles all WhatsApp communication: OTP, notifications, order confirmations, Laerte alerts.

### Operational Compliance (Laerte)

- **MEI CNAE code:** Confirm correct food delivery CNAE with a contador before registration — wrong code invalidates VR credenciamento.
- **Food handler certificate:** Curso de manipulador de alimentos required before first service. One-day course.
- **Packaging labeling:** Ingredient and allergen label required on container. Printed label suffices at launch. In-app allergen display deferred to Phase 2.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Person-as-Moat Brand Strategy**
In a market dominated by faceless aggregators (iFood, Rappi), the brand is a specific human with 40+ years of cooking history. Seu Laerte's face, name, and recipes are the product. No competitor can replicate this. The moat strengthens over time — loyalty is to a person, not a platform.

**2. Lobby-as-Marketing-Mechanism**
The daily pickup operation is simultaneously the acquisition channel. Laerte at 11:45am with a thermal bag is a live product demo in front of hundreds of hungry office workers. Zero ad spend — the product markets itself daily through visible social proof.

**3. Pre-Order-Driven Zero-Waste Production**
Most food delivery is reactive — demand unknown until orders arrive. This model inverts it: orders close at midnight, production quantities are set before shopping, Laerte never cooks blind. Zero waste, exact cost control, predictable unit economics from day one. The capacity lock, nightly email, and order cutoff all exist in service of this model.

### Competitive Landscape

These three advantages compound in a way structurally hard to replicate at scale:
- iFood can replicate the app; not Laerte
- A competitor can replicate the lobby model; not the 40-year recipe history
- The pre-order model requires subscriber trust that only builds over time

### Validation Approach

- **Person-as-moat:** Validated when a subscriber cites Laerte personally — not price or convenience — as their reason to stay
- **Lobby-as-marketing:** Validated when new subscribers cite "I saw someone pick up in the lobby" as their discovery moment
- **Pre-order model:** Validated at Week 1 — zero wasted marmitas confirms the model works

### Risk Mitigation

- **Key-person dependency:** Business depends on Laerte's health and availability. Vision-phase mitigation: train new cooks on his recipes. For MVP/Growth, this risk is accepted.
- **Lobby access:** Building management could restrict vendors. Formalize as authorized vendor once daily demand is established.

## Web App Specific Requirements

### Project-Type Overview

Next.js hybrid web application — server-rendered for public pages (SEO, performance), client-side for authenticated order flow. Mobile-first: primary use case is ordering from a phone in under 3 minutes.

### Browser Matrix

| Platform | Target | Notes |
|---|---|---|
| Mobile Safari (iOS) | Primary | Dominant in Faria Lima corporate demographic |
| Mobile Chrome (Android) | Primary | Full Brazilian smartphone market coverage |
| Desktop Chrome / Firefox / Safari | Secondary | Users ordering from work computers |
| IE / Legacy browsers | Not supported | Modern browsers only |

### Responsive Design

- Mobile-first layout at all breakpoints; single-column on mobile, max-width container on desktop
- Pix key display tap-to-copy on mobile

### SEO Strategy

- Public pages (landing, weekly menu): SSR/SSG, meta tags, Open Graph for WhatsApp link previews
- Auth and order flow pages: `noindex`
- Target keyword: "marmita Faria Lima" — menu page content supports this naturally

### Implementation Considerations

- Next.js App Router: server components for public pages, client components for order/auth flow
- Supabase for session management (30-day cookie), no NextAuth
- Z-API webhook handling via Next.js API routes (server-side only)
- Pix key generation and payment confirmation server-side only
- No real-time subscriptions — capacity counter refreshes on page load

## Product Scope & Phased Development

### MVP Strategy

**Approach:** Revenue MVP — first version accepts real Pix payments and serves real customers. Learning comes from paying orders, not prototypes.
**Team:** 1 developer (Lucas), solo build.

### Phase 1 — MVP

**Core User Journeys Supported:**
- Ana (happy path): discover → sign up → order → pay → pick up → rate
- Rafael (edge case): OTP resend, Pix expiry + regeneration, pre-payment cancellation
- Laerte (ops): midnight order cutoff, nightly email with tomorrow's list

**Must-Have Capabilities:**
- Web app (Next.js, mobile-first, SEO-optimized public pages)
- Phone number + WhatsApp OTP auth via Z-API (with resend)
- Weekly menu display with per-day availability and "esgotado" states
- Order flow with per-day capacity lock at 100
- Order cutoff at midnight (previous day)
- Pix checkout: key generation, 30-min expiry, regeneration, "aguardando pagamento" state
- Cancellation before payment (slot released); cancellation locked after payment
- WhatsApp: order confirmation to customer, new order alert to Laerte, Sunday menu reveal, morning dish story, 1pm rating prompt
- LGPD consent checkbox + privacy policy page at signup
- Nightly automated email to Laerte (Excel: name, phone, order details)
- Supabase sessions (30-day cookie)

### Phase 2 — Growth

- Subscription management (weekly and monthly plans with discounted pricing)
- Mercado Pago integration (credit card + automated recurring billing)
- Dad's ops dashboard (today's list, weekly production view, subscriber overview, revenue summary)
- Dietary flags and allergen profiling
- Ratings system with history and aggregate social proof display ("Média 4.8 ⭐ em X refeições" on landing page)
- Order history page

### Phase 3 — Expansion

- "Cozinha Oliveira" brand evolution
- Floor Captain model (corporate team subscriptions)
- Building partnership / authorized vendor credentialing
- Menu intelligence loop (fan favorites return by popular demand)
- Paid order postponement (move confirmed order to another available date)
- Laerte training new cooks on family recipes

### Risk Mitigation

**Technical:** Z-API OTP reliability is the single highest-risk component — WhatsApp number ban breaks auth entirely. Keep messages minimal and opt-in; SMS fallback (Twilio) as post-MVP hardening. Build and test the full Pix payment flow (key generation → webhook confirmation) before any other feature.

**Market:** If Week 1 falls short of 10 orders, the risk is the flyer campaign or lobby access, not the platform.

**Resource:** Solo build — scope creep into Phase 2 features delays launch. Phase 1 boundary is fixed.

## Functional Requirements

### Authentication & Identity

- **FR1:** Customer can authenticate using their phone number and a one-time code delivered via WhatsApp
- **FR2:** Customer can request a new one-time code if the first one does not arrive
- **FR3:** Authenticated customer sessions persist for 30 days without requiring re-authentication
- **FR4:** Customer can provide explicit consent to receive WhatsApp notifications during signup

### Menu & Discovery

- **FR5:** Any visitor can view the current week's menu with dish names, descriptions, and per-day availability
- **FR6:** Any visitor can see which days have reached maximum capacity
- **FR7:** Admin can create and update the weekly menu for any week
- **FR8:** The menu page is publicly accessible without authentication and indexable by search engines

### Ordering

- **FR9:** Authenticated customer can place an order for any available day
- **FR10:** Customer can view the current status of their order
- **FR11:** Customer can cancel an order that has not yet been paid; the day's available slot is restored
- **FR12:** Customer cannot cancel an order after payment has been confirmed
- **FR13:** System prevents new orders for a day once 100 confirmed orders have been placed
- **FR14:** System stops accepting new orders for a given day at midnight of the preceding day

### Payment

- **FR15:** Customer can initiate Pix payment for a pending order
- **FR16:** Customer can view the Pix key for their pending payment
- **FR17:** System expires a Pix key after 30 minutes if payment has not been confirmed
- **FR18:** Customer can request a new Pix key for an order with an expired payment window

### Notifications & Communication

- **FR19:** Customer receives a WhatsApp confirmation when their order payment is confirmed
- **FR20:** Customer receives a WhatsApp message each Sunday with the upcoming week's full menu
- **FR21:** Customer receives a WhatsApp message each delivery morning with the dish story for that day
- **FR22:** Customer receives a WhatsApp prompt at 1pm on each delivery day to rate their meal
- **FR23:** Customer receives a WhatsApp confirmation when they cancel an order before payment
- **FR24:** Laerte receives a WhatsApp alert each time a new order is placed

### Operations

- **FR25:** System sends Laerte an automated email each midnight with an Excel attachment listing next-day orders (customer name, phone number, order details)
- **FR26:** Admin can compose and schedule the weekly menu reveal message and daily dish story notifications
- **FR27:** System tracks confirmed order count per day and makes it accessible to admin

### Compliance & Privacy

- **FR28:** Customer must provide explicit WhatsApp notification consent before completing signup
- **FR29:** A privacy policy page is accessible from the signup flow
- **FR30:** Customer can submit a request for deletion of their personal data
- **FR31:** Customer can submit a meal rating after receiving the 1pm prompt (rating stored; aggregate display is Phase 2)

## Non-Functional Requirements

### Performance

- **NFR1:** Public menu page achieves LCP < 2.5s on a 3G mobile connection
- **NFR2:** Order flow interactions (button taps, form submissions) respond within 300ms
- **NFR3:** Pix key generation completes within 5 seconds of order placement
- **NFR4:** WhatsApp OTP message delivered within 60 seconds of request

### Security

- **NFR5:** All data in transit encrypted via HTTPS/TLS
- **NFR6:** All data at rest in Supabase encrypted (Supabase default)
- **NFR7:** OTP codes expire after 10 minutes and are single-use
- **NFR8:** Pix key generation and payment confirmation handled server-side only — no payment logic in the browser
- **NFR9:** Phone numbers and personal data stored only in Supabase; never logged in plain text

### Reliability

- **NFR10:** OTP delivery failure triggers automatic retry; customer is informed if delivery fails after retry
- **NFR11:** Nightly email failure triggers a fallback alert to Lucas
- **NFR12:** Failed Pix confirmation webhooks are logged and surfaced to admin for manual resolution
- **NFR13:** System maintains order count integrity under concurrent requests — two customers cannot claim the last slot simultaneously

### Integration

- **NFR14:** Z-API connection failures degrade gracefully — customer-facing operations show a clear error, not a crash
- **NFR15:** Nightly email generation and send completes within 5 minutes of midnight cutoff
- **NFR16:** Z-API webhook events are idempotent — duplicate delivery does not create duplicate orders or notifications

### Accessibility

- **NFR17:** All customer-facing screens meet WCAG 2.1 AA contrast ratios; sufficient for outdoor/bright-screen reading
- **NFR18:** Interactive elements (OTP input, order buttons, Pix copy) meet minimum 44x44px touch target size
- **NFR19:** Error messages on critical flows (OTP, payment) are text-based and not reliant solely on color
