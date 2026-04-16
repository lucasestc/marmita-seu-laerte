-- Migration: Initial schema for Marmita do Seu Laerte
-- Creates customers and otp_codes tables (Epic 1 / Story 1.1)

-- customers: stores registered customers identified by phone number
CREATE TABLE IF NOT EXISTS customers (
  id                bigserial PRIMARY KEY,
  phone             text UNIQUE NOT NULL,       -- E.164 format: +5511999999999
  name              text,
  whatsapp_consent  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);

-- otp_codes: stores hashed one-time codes for WhatsApp authentication
CREATE TABLE IF NOT EXISTS otp_codes (
  id          bigserial PRIMARY KEY,
  phone       text NOT NULL,                    -- E.164 format
  code_hash   text NOT NULL,                    -- bcrypt hash; raw code sent via WhatsApp only
  expires_at  timestamptz NOT NULL,             -- 10 minutes from creation
  used_at     timestamptz,                      -- NULL = unused; set on first successful verification
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast OTP lookup by phone (login flow)
CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes (phone);

-- Index for customer lookup by phone (session creation)
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
