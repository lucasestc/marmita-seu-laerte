import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// GET /api/cron/rating-prompt
// Cron: 0 16 * * 1-5  (1pm Brasília, weekdays)
//
// Sends each customer with a confirmed order today a one-tap rating link via
// WhatsApp. Idempotent: skips orders where rating_prompt_sent_at is already set.
// Sets rating_prompt_sent_at after a successful send.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[rating-prompt] Unauthorised cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const supabase = createServiceClient()

  // Fetch confirmed orders today that haven't had a rating prompt sent yet
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, display_id, customers(phone)')
    .eq('delivery_date', todayBrasilia)
    .eq('status', 'confirmado')
    .is('rating_prompt_sent_at', null)

  if (ordersError) {
    console.error('[rating-prompt] Failed to fetch orders', ordersError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  type OrderWithCustomer = {
    id: number
    display_id: string
    customers: { phone: string } | null
  }

  const eligible = (orders ?? []) as unknown as OrderWithCustomer[]

  let sent = 0

  // Process sequentially to avoid hammering Z-API and to keep mark-as-sent tight
  for (const order of eligible) {
    const phone = order.customers?.phone
    if (!phone) continue

    const ratingUrl = `${appUrl}/rate/${order.display_id}`
    const message = `Como foi o almoço hoje? 🍽️ Clique para avaliar: ${ratingUrl}`

    try {
      await sendMessage(phone, message)
    } catch (err: unknown) {
      console.error('[rating-prompt] sendMessage failed', {
        orderId: order.id,
        phone,
        error: err instanceof Error ? err.message : String(err),
      })
      continue // don't mark as sent if message failed
    }

    // Mark prompt as sent — failure here is non-fatal (worst case: duplicate prompt)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ rating_prompt_sent_at: new Date().toISOString() })
      .eq('id', order.id)

    if (updateError) {
      console.error('[rating-prompt] Failed to mark rating_prompt_sent_at', {
        orderId: order.id,
        error: updateError.message,
      })
    }

    sent++
  }

  console.log('[rating-prompt] Done', { date: todayBrasilia, sent, total: eligible.length })
  return NextResponse.json({ ok: true, sent, total: eligible.length })
}
