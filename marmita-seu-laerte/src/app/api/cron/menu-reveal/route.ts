import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'
import { nextMondayFrom } from '@/lib/date-helpers'

// ---------------------------------------------------------------------------
// GET /api/cron/menu-reveal
// Cron: 0 23 * * 0  (8pm Brasília, Sunday)
//
// Sends next week's full menu to every customer with whatsapp_consent = true.
// Exits silently (no messages) if no next-week menu is published yet.
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[menu-reveal] Unauthorised cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  const nextMonday = nextMondayFrom(todayBrasilia)

  const supabase = createServiceClient()

  // Fetch next week's menu items ordered by delivery date
  const { data: items, error: menuError } = await supabase
    .from('menu_items')
    .select('delivery_date, name')
    .gte('delivery_date', nextMonday)
    .lt('delivery_date', nextMondayFrom(nextMonday))
    .order('delivery_date', { ascending: true })

  if (menuError) {
    console.error('[menu-reveal] Failed to fetch next week menu', menuError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!items || items.length === 0) {
    console.warn('[menu-reveal] No next-week menu found, skipping sends', { nextMonday })
    return NextResponse.json({ ok: true, sent: 0, reason: 'no-menu' })
  }

  // Build menu lines: "Segunda: Frango grelhado"
  const menuLines = items
    .map((item) => {
      const date = new Date(`${item.delivery_date as string}T12:00:00Z`)
      const dow = date.getUTCDay()
      const label = WEEKDAY_LABELS[dow] ?? item.delivery_date
      return `${label}: ${item.name as string}`
    })
    .join('\n')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const message = [
    '📋 Cardápio da semana!',
    '',
    menuLines,
    '',
    `Faça seu pedido em ${appUrl}`,
  ].join('\n')

  // Fetch all consenting customers
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('phone')
    .eq('whatsapp_consent', true)

  if (custError) {
    console.error('[menu-reveal] Failed to fetch customers', custError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const phones = (customers ?? []).map((c) => c.phone as string)

  // Send sequentially with a 500ms delay between each message to avoid Z-API rate limits
  // and reduce the risk of number ban from bulk sends.
  let sent = 0
  for (let i = 0; i < phones.length; i++) {
    try {
      await sendMessage(phones[i], message)
      sent++
    } catch (err) {
      console.error('[menu-reveal] sendMessage failed', {
        phone: phones[i],
        error: err instanceof Error ? err.message : String(err),
      })
    }
    if (i < phones.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  console.log('[menu-reveal] Done', { nextMonday, sent, total: phones.length })
  return NextResponse.json({ ok: true, sent, total: phones.length })
}
