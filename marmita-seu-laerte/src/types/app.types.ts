/**
 * Application-level TypeScript types for Marmita do Seu Laerte.
 * These are domain types used across server and client code.
 * DB-generated types live in database.types.ts (auto-generated, never edit manually).
 */

export type Customer = {
  id: number
  phone: string
  name: string | null
  whatsapp_consent: boolean
  created_at: string
  updated_at: string | null
}

export type OtpCode = {
  id: number
  phone: string
  code_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type OrderStatus =
  | 'aguardando_pagamento'
  | 'confirmado'
  | 'entregue'
  | 'cancelado'

export type Order = {
  id: number
  display_id: string          // zero-padded 4-digit string, e.g. "0023"
  customer_id: number
  menu_item_id: number
  delivery_date: string       // ISO date string: "2026-04-10"
  status: OrderStatus
  pix_key: string | null
  pix_expires_at: string | null
  created_at: string
  updated_at: string | null
}

export type MenuWeek = {
  id: number
  week_start: string   // ISO date string: "2026-04-07" (always a Monday)
  created_at: string
  updated_at: string | null
}

export type MenuItem = {
  id: number
  menu_week_id: number
  delivery_date: string   // ISO date string: "2026-04-07"
  name: string
  description: string | null
  morning_message: string | null
  created_at: string
  updated_at: string | null
}

/** MenuItem enriched with live slot data for the menu page */
export type MenuItemWithSlots = MenuItem & {
  confirmedOrders: number
  availableSlots: number
}

/** Standard return type for all Server Actions */
export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }
