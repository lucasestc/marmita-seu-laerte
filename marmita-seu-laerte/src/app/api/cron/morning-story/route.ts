import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'

// ---------------------------------------------------------------------------
// GET /api/cron/morning-story
// Cron: 0 11 * * 1-5  (8am Brasília, weekdays)
//
// Sends each customer with a confirmed order today a WhatsApp message about
// their dish. Uses menu_items.morning_message if set, else falls back to
// dish name + description.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[morning-story] Unauthorised cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })

  const supabase = createServiceClient()

  // Fetch today's menu item for the dish story
  const { data: menuItem, error: menuError } = await supabase
    .from('menu_items')
    .select('name, description, morning_message')
    .eq('delivery_date', todayBrasilia)
    .single()

  if (menuError || !menuItem) {
    console.log('[morning-story] No menu item for today', { date: todayBrasilia })
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Build message text — prefer morning_message, fall back to name + description
  const storyText: string =
    (menuItem.morning_message as string | null) ??
    [
      `🍱 Hoje tem ${menuItem.name as string}!`,
      menuItem.description ? (menuItem.description as string) : null,
      '— Seu Laerte',
    ]
      .filter(Boolean)
      .join(' ')

  // Fetch all customers with a confirmed order today
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('customers(phone)')
    .eq('delivery_date', todayBrasilia)
    .eq('status', 'confirmado')

  if (ordersError) {
    console.error('[morning-story] Failed to fetch orders', ordersError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const customers = (orders ?? []).map(
    (o) => (o.customers as unknown as { phone: string } | null)?.phone,
  ).filter((p): p is string => Boolean(p))

  // Send in parallel — individual failures are logged but do not abort others
  const results = await Promise.allSettled(
    customers.map((phone) => sendMessage(phone, storyText)),
  )

  let sent = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++
    } else {
      console.error('[morning-story] sendMessage failed', {
        phone: customers[i],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
    }
  })

  console.log('[morning-story] Done', { date: todayBrasilia, sent, total: customers.length })
  return NextResponse.json({ ok: true, sent, total: customers.length })
}
