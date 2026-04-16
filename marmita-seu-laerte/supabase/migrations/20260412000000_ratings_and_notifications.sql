-- Adds morning_message to menu_items, rating_prompt_sent_at to orders,
-- and creates the ratings table (Epic 4 — Stories 4.3, 4.4, 5.1)

-- morning_message: Laerte can set a custom WhatsApp story text per dish day.
-- Falls back to dish name + description if null.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS morning_message text;

-- rating_prompt_sent_at: set after the 1pm cron sends the rating link,
-- used as an idempotency guard to prevent duplicate prompts per order.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating_prompt_sent_at timestamptz;

-- ratings: one row per order (customer rates their meal after delivery)
CREATE TABLE IF NOT EXISTS ratings (
  id          bigserial PRIMARY KEY,
  order_id    bigint NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id bigint NOT NULL REFERENCES customers(id),
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ratings_customer_idx ON ratings (customer_id);
