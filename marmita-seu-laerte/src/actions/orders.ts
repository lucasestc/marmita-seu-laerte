'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { sendMessage } from '@/lib/zapi'
import type { ActionResult } from '@/types/app.types'
import { formatDeliveryDateShort } from '@/lib/date-helpers'

// ---------------------------------------------------------------------------
// renewPixExpiry
// ---------------------------------------------------------------------------

/**
 * Regenerate the Pix payment window for an order that is still
 * `aguardando_pagamento`.  Returns the new expiry timestamp on success so
 * the client can update the countdown timer without a full page reload.
 *
 * Rejects silently-wrong inputs (wrong owner, wrong status) with a
 * Portuguese error message — never leaks server-side detail.
 */
export async function renewPixExpiry(
  orderId: number,
): Promise<ActionResult<{ newExpiresAt: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Você precisa estar autenticado.' }
  }

  const supabase = createServiceClient()

  // Resolve customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', session.phone)
    .single()

  if (customerError || !customer) {
    return { success: false, error: 'Sessão inválida. Faça login novamente.' }
  }

  // Fetch order with ownership check in the same query
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('customer_id', customer.id)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Pedido não encontrado.' }
  }

  if (order.status !== 'aguardando_pagamento') {
    return { success: false, error: 'Este pedido não pode ser atualizado.' }
  }

  const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('orders')
    .update({ pix_expires_at: newExpiresAt })
    .eq('id', order.id as number)

  if (updateError) {
    console.error('[renewPixExpiry] update failed', updateError.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  return { success: true, data: { newExpiresAt } }
}

// ---------------------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------------------

/**
 * Cancel an order that is still `aguardando_pagamento`.
 *
 * - Rejects orders with status `confirmado`, `entregue`, or `cancelado`.
 * - Sends a WhatsApp cancellation confirmation to the customer (non-blocking —
 *   a Z-API failure is logged but the cancellation still succeeds).
 */
export async function cancelOrder(orderId: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Você precisa estar autenticado.' }
  }

  const supabase = createServiceClient()

  // Resolve customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', session.phone)
    .single()

  if (customerError || !customer) {
    return { success: false, error: 'Sessão inválida. Faça login novamente.' }
  }

  // Fetch order with ownership check
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, display_id')
    .eq('id', orderId)
    .eq('customer_id', customer.id)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Pedido não encontrado.' }
  }

  if (order.status === 'confirmado') {
    return { success: false, error: 'Pedidos já confirmados não podem ser cancelados.' }
  }

  if (order.status !== 'aguardando_pagamento') {
    return { success: false, error: 'Este pedido não pode ser cancelado.' }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', order.id as number)

  if (updateError) {
    console.error('[cancelOrder] update failed', updateError.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  // Non-blocking WhatsApp notification — failure must not block cancellation
  const displayId = order.display_id as string
  sendMessage(
    session.phone,
    `Seu pedido #${displayId} foi cancelado. Esperamos te ver em breve! 🍱 — Seu Laerte`,
  ).catch((err: unknown) => {
    console.error('[cancelOrder] WhatsApp notification failed', {
      orderId,
      displayId,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Helpers (formatDeliveryDateShort imported from @/lib/date-helpers)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// placeOrder
// ---------------------------------------------------------------------------

const placeOrderSchema = z.object({
  menuItemId: z.number().int().positive(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de entrega inválida.'),
})

/**
 * Place an order for an available delivery day.
 *
 * Validates the midnight cutoff, then delegates the atomic capacity check
 * and insertion to the `place_order` Postgres RPC, which uses an advisory
 * lock to prevent overselling under concurrent load.
 *
 * On success: redirects to /checkout/[displayId] (never returns to caller).
 * On failure: returns ActionResult with a Portuguese error message.
 */
export async function placeOrder(
  menuItemId: number,
  deliveryDate: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Você precisa estar autenticado.' }
  }

  const parsed = placeOrderSchema.safeParse({ menuItemId, deliveryDate })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  // Midnight cutoff: reject orders for today or any past date (Brasília time).
  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  if (parsed.data.deliveryDate <= todayBrasilia) {
    return { success: false, error: 'As reservas para este dia estão encerradas.' }
  }

  const supabase = createServiceClient()

  // Look up customer by phone (session carries the phone, not the id)
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name')
    .eq('phone', session.phone)
    .single()

  if (customerError || !customer) {
    console.error('[placeOrder] customer lookup failed', customerError?.message)
    return { success: false, error: 'Sessão inválida. Faça login novamente.' }
  }

  // Atomic capacity check + insert via Postgres RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('place_order', {
    p_customer_id: customer.id,
    p_menu_item_id: parsed.data.menuItemId,
    p_delivery_date: parsed.data.deliveryDate,
  })

  if (rpcError) {
    console.error('[placeOrder] RPC failed', rpcError.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  if (!rpcResult.success) {
    if (rpcResult.error_code === 'CAPACITY_EXCEEDED') {
      return { success: false, error: 'Esgotado para este dia. Escolha outro dia.' }
    }
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  // Alert Laerte — non-blocking, failure must not prevent the redirect
  const laertePhone = process.env.LAERTE_PHONE
  if (laertePhone) {
    const customerName = (customer.name as string | null) ?? 'Cliente'
    const deliveryLabel = formatDeliveryDateShort(parsed.data.deliveryDate)
    const alertText =
      `Novo pedido! #${rpcResult.display_id} — ${customerName} (${session.phone}) — ${deliveryLabel} — R$\u00A035,00`

    sendMessage(laertePhone, alertText).catch((err: unknown) => {
      console.error('[placeOrder] Laerte alert failed', {
        displayId: rpcResult.display_id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  redirect(`/checkout/${rpcResult.display_id}`)
}
