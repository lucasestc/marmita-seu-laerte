---
story_key: "2-1-public-menu-page"
epic: 2
story: 2.1
status: review
---

# Story 2.1: Public Weekly Menu Page

## Story

As a visitor,
I want to view this week's full menu with dish details and per-day availability,
So that I can discover what Seu Laerte is cooking and decide when to order.

## Acceptance Criteria

**AC1:** `menu_weeks` and `menu_items` tables exist in the DB. `orders` table also added (Epic 3 schema, needed for slot queries).

**AC2:** Visitors navigating to `/menu` or `/` see the SSR menu page. `/` redirects server-side to `/menu`. Each weekday shows: name, description (2-line clamp), available slot count, and a "Fazer pedido" CTA. Days with 100 confirmed orders show "Esgotado" with a disabled CTA.

**AC3:** No menu for current week → "O cardápio desta semana ainda não foi publicado. Volte em breve!"

**AC4:** `<head>` includes `<title>`, `<meta name="description">`, and Open Graph tags (`og:title`, `og:description`, `og:image`) for WhatsApp link previews. Page is NOT `noindex`.

**AC5:** Single-column layout, cards full-width. CTA anchor meets 44px min-height touch target.

## Tasks / Subtasks

- [x] **Task 1: DB migration**
  - [x] `supabase/migrations/20260411000000_menu_and_orders_schema.sql`
  - [x] `menu_weeks` (id, week_start date unique, created_at, updated_at)
  - [x] `menu_items` (id, menu_week_id FK, delivery_date, name, description, created_at, updated_at)
  - [x] `orders` (schema stub — id, display_id, customer_id FK, menu_item_id FK, delivery_date, status check, pix_key, pix_expires_at, created_at, updated_at)
  - [x] Indexes: menu_items(menu_week_id), menu_items(delivery_date), orders(status, delivery_date), orders(customer_id)

- [x] **Task 2: Types**
  - [x] `MenuWeek`, `MenuItem`, `MenuItemWithSlots` added to `src/types/app.types.ts`

- [x] **Task 3: `MenuDayCard` component**
  - [x] Created `src/components/features/MenuDayCard.tsx`
  - [x] Day label formatted via `Intl` (`pt-BR`, `America/Sao_Paulo`) — "Segunda · 7 de abril"
  - [x] Available state: amber slot count + "Fazer pedido" anchor (styled via `buttonVariants`)
  - [x] Sold-out state: card `opacity-50`, "Esgotado" text + disabled CTA span
  - [x] `orderHref` prop defaults to `/login`; Story 3 will pass real order URL

- [x] **Task 4: `/menu` page**
  - [x] Created `src/app/(public)/menu/page.tsx` — SSR Server Component
  - [x] `getCurrentWeekMonday()` — calculates Monday of current week in Brasília timezone
  - [x] `formatWeekRange()` — "7 a 11 de abril de 2026" (same month) or "28 de abril a 2 de maio de 2026" (cross-month)
  - [x] `getMenuItems()` — fetches menu_weeks + nested menu_items in one query, then counts confirmed orders per date
  - [x] Non-fatal orders query failure: renders menu with full capacity (console.error only)
  - [x] Full metadata: title, description, Open Graph tags

- [x] **Task 5: Root page redirect**
  - [x] `src/app/page.tsx` → `redirect('/menu')` (server-side, Next.js `redirect()`)

- [x] **Task 6: TypeScript check**
  - [x] `npx tsc --noEmit` — zero errors

## Dev Notes

### Technical Context

**Stack:** Next.js 16.2.3 App Router, TypeScript strict, Tailwind CSS v4, Supabase JS

**Route group:** `src/app/(public)/menu/page.tsx` — follows architecture's `(public)` group convention

**Supabase client:** `createServerClient()` (anon key, SSR) used for menu + order queries. No RLS policies configured yet — anon key has full read access in development. **Before production:** add RLS policies allowing public SELECT on `menu_weeks`, `menu_items`, and public COUNT on `orders WHERE status = 'confirmado'`.

**Slot count query logic:**
1. Fetch `menu_weeks` row for current week (Monday date, Brasília timezone)
2. Fetch nested `menu_items` in same query (PostgREST FK join)
3. Count `orders WHERE delivery_date IN (...) AND status = 'confirmado'`
4. Available slots = `MAX(0, 100 - confirmedCount)` per day
5. If orders query fails: non-fatal, renders with full capacity

**`orders` table in this migration:** Schema included here (not Story 3) so the slot display query works immediately. Story 3 adds the ordering Server Action but relies on this table.

**`MenuDayCard` CTA:** Uses `<a href={orderHref}>` styled with `buttonVariants()` — no `asChild` needed (Base UI Button has no `asChild`). Story 3 will replace with the actual order link per day.

**Date handling:**
- `toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })` → reliable YYYY-MM-DD in Brasília time
- `new Date('2026-04-07T12:00:00Z')` — noon UTC avoids off-by-one from DST/timezone shifts
- `pt-BR` locale with `America/Sao_Paulo` timezone for all display strings

**OG image:** `/og-image.jpg` referenced in metadata. Placeholder — a real photo of Laerte's marmita should be added to `/public/og-image.jpg` before launch.

**Migration to run:**
```bash
supabase db push
```

## File List

- `supabase/migrations/20260411000000_menu_and_orders_schema.sql` (new)
- `src/types/app.types.ts` (modified — added MenuWeek, MenuItem, MenuItemWithSlots)
- `src/components/features/MenuDayCard.tsx` (new)
- `src/app/(public)/menu/page.tsx` (new)
- `src/app/page.tsx` (modified — now redirects to /menu)

## Change Log

- 2026-04-11: Story created and implemented — all 6 tasks complete, all ACs satisfied, `tsc --noEmit` clean.
