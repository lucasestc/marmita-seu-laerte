-- Migration: Menu and Orders schema for Marmita do Seu Laerte
-- Adds menu_weeks, menu_items (Epic 2) and orders (Epic 3 — schema only)

-- menu_weeks: one row per delivery week, keyed by its Monday date
CREATE TABLE IF NOT EXISTS menu_weeks (
  id          bigserial PRIMARY KEY,
  week_start  date UNIQUE NOT NULL,  -- ISO date of the Monday that opens the week
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- menu_items: one row per delivery day within a week
CREATE TABLE IF NOT EXISTS menu_items (
  id            bigserial PRIMARY KEY,
  menu_week_id  bigint NOT NULL REFERENCES menu_weeks(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,       -- concrete weekday date (Mon-Fri)
  name          text NOT NULL,       -- dish name shown to customers
  description   text,               -- 1-2 sentence description (optional)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);

CREATE INDEX IF NOT EXISTS menu_items_week_idx ON menu_items (menu_week_id);
CREATE INDEX IF NOT EXISTS menu_items_date_idx ON menu_items (delivery_date);

-- orders: one row per customer order (ordering flow implemented in Epic 3)
-- Schema created here so the menu page can query confirmed order counts.
CREATE TABLE IF NOT EXISTS orders (
  id             bigserial PRIMARY KEY,
  display_id     text UNIQUE NOT NULL,    -- zero-padded 4-digit, e.g. '0001' (Laerte reads this)
  customer_id    bigint NOT NULL REFERENCES customers(id),
  menu_item_id   bigint NOT NULL REFERENCES menu_items(id),
  delivery_date  date NOT NULL,           -- denormalized for fast capacity queries
  status         text NOT NULL DEFAULT 'aguardando_pagamento'
                   CHECK (status IN (
                     'aguardando_pagamento',  -- placed, awaiting Pix payment
                     'confirmado',            -- Laerte confirmed receipt of payment
                     'entregue',              -- handed to customer at lobby
                     'cancelado'              -- cancelled before confirmation
                   )),
  pix_key        text,                    -- Pix key shown to customer at checkout
  pix_expires_at timestamptz,            -- 30-min window; null after expiry/cancellation
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz
);

-- Composite index for the capacity check: count confirmed orders per delivery date
CREATE INDEX IF NOT EXISTS orders_status_date_idx ON orders (status, delivery_date);
CREATE INDEX IF NOT EXISTS orders_customer_idx    ON orders (customer_id);
