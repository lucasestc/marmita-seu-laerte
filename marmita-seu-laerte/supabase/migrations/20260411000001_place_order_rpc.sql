-- Migration: place_order RPC for atomic capacity-checked order insertion

-- Sequential source for display_id (human-readable order number like "0023").
-- Using a dedicated sequence means display_id generation is always atomic
-- and independent of concurrent orders for different delivery dates.
CREATE SEQUENCE IF NOT EXISTS orders_display_id_seq START 1;

-- ---------------------------------------------------------------------------
-- place_order
-- ---------------------------------------------------------------------------
-- Performs a capacity-checked, race-safe order insertion for a single
-- delivery date. The advisory lock serialises concurrent calls for the SAME
-- delivery date; calls for different dates proceed in parallel.
--
-- Returns jsonb:
--   { "success": true,  "display_id": "0023" }
--   { "success": false, "error_code": "CAPACITY_EXCEEDED" }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_order(
  p_customer_id   bigint,
  p_menu_item_id  bigint,
  p_delivery_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count      integer;
  v_next_id    bigint;
  v_display_id text;
BEGIN
  -- Acquire a transaction-scoped advisory lock keyed on the delivery date.
  -- This serialises the count + insert pair for any given date, preventing
  -- two simultaneous requests from both reading count = 99 and both succeeding.
  -- The lock is released automatically when the transaction commits or rolls back.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_delivery_date::text), 1, 16))::bit(64)::bigint
  );

  -- Count all non-cancelled orders for this delivery date.
  SELECT COUNT(*) INTO v_count
  FROM orders
  WHERE delivery_date = p_delivery_date
    AND status != 'cancelado';

  IF v_count >= 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_EXCEEDED');
  END IF;

  -- Claim the next globally-unique display_id.
  v_next_id    := nextval('orders_display_id_seq');
  v_display_id := lpad(v_next_id::text, 4, '0');

  INSERT INTO orders (customer_id, menu_item_id, delivery_date, display_id, status)
  VALUES (p_customer_id, p_menu_item_id, p_delivery_date, v_display_id, 'aguardando_pagamento');

  RETURN jsonb_build_object('success', true, 'display_id', v_display_id);
END;
$$;
