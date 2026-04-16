import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'
import { normalisePhone } from '@/lib/phone-helpers'
import { formatDeliveryDateShort } from '@/lib/date-helpers'

// ---------------------------------------------------------------------------
// Z-API webhook payload type (incoming message callback)
// ---------------------------------------------------------------------------

type ZApiPayload = {
  phone?: string
  body?: string     // text content of the message
  isGroup?: boolean
  fromMe?: boolean
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/zapi
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Token auth — prevent arbitrary callers from triggering order confirmations
  // Token must be passed via X-Webhook-Token header (not URL query param, which leaks in logs)
  const secret = process.env.WEBHOOK_SECRET
  const token = request.headers.get('x-webhook-token')

  if (!secret || token !== secret) {
    console.warn('[zapi-webhook] Unauthorised request', {
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse payload
  let payload: ZApiPayload
  try {
    payload = (await request.json()) as ZApiPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawPhone = payload.phone ?? ''
  const body = (payload.body ?? '').trim()
  const senderPhone = normalisePhone(rawPhone)

  const laertePhone = normalisePhone(process.env.LAERTE_PHONE ?? '')

  // 3. Ignore messages not from Laerte or not matching the PAGO pattern
  const pagoMatch = body.match(/^PAGO\s+(\d{4})$/i)
  if (!laertePhone || senderPhone !== laertePhone || !pagoMatch) {
    console.log('[zapi-webhook] Ignored message', { senderPhone, body })
    return NextResponse.json({ ok: true })
  }

  const displayId = pagoMatch[1] // e.g. "0023"

  const supabase = createServiceClient()

  // 4. Look up order by display_id
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, delivery_date, customer_id')
    .eq('display_id', displayId)
    .single()

  if (orderError || !order) {
    console.error('[zapi-webhook] Order not found', { displayId })
    return NextResponse.json({ ok: true })
  }

  // 5. Idempotent — already confirmed, skip
  if (order.status === 'confirmado') {
    console.log('[zapi-webhook] Order already confirmado, skipping', { displayId })
    return NextResponse.json({ ok: true })
  }

  // 6. Only confirm orders awaiting payment
  if (order.status !== 'aguardando_pagamento') {
    console.log('[zapi-webhook] Order not awaiting payment, skipping', {
      displayId,
      status: order.status,
    })
    return NextResponse.json({ ok: true })
  }

  // 7. Update order status to confirmado
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'confirmado' })
    .eq('id', order.id as number)

  if (updateError) {
    console.error('[zapi-webhook] Failed to confirm order', {
      displayId,
      error: updateError.message,
    })
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // 8. Fetch customer phone for confirmation message
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('phone')
    .eq('id', order.customer_id as number)
    .single()

  if (customerError || !customer) {
    console.error('[zapi-webhook] Customer not found after confirm', {
      displayId,
      customerId: order.customer_id,
    })
    return NextResponse.json({ ok: true })
  }

  // 9. Send customer confirmation (non-blocking — order is already confirmed)
  const deliveryLabel = formatDeliveryDateShort(order.delivery_date as string)
  const confirmationText =
    `Pedido confirmado! ${deliveryLabel} às 11h45 no lobby. Até lá! 🍱 — Seu Laerte`

  sendMessage(customer.phone as string, confirmationText).catch((err: unknown) => {
    console.error('[zapi-webhook] Customer confirmation WhatsApp failed', {
      displayId,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return NextResponse.json({ ok: true })
}
