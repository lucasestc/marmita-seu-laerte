import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/zapi'
import { tomorrowBrasilia, formatDeliveryDateShort as formatDateLabel } from '@/lib/date-helpers'
import type { OrderStatus } from '@/types/app.types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Confirmado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderRow = {
  display_id: string
  status: OrderStatus
  delivery_date: string
  customers: { name: string | null; phone: string } | null
  menu_items: { name: string } | null
}

// ---------------------------------------------------------------------------
// GET /api/cron/nightly-email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // 1. Auth — Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[nightly-email] Unauthorised cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = tomorrowBrasilia()
  const dateLabel = formatDateLabel(tomorrow)

  // 2. Fetch orders for tomorrow (confirmed or awaiting payment)
  const supabase = createServiceClient()

  const { data: orders, error: dbError } = await supabase
    .from('orders')
    .select('display_id, status, delivery_date, customers(name, phone), menu_items(name)')
    .eq('delivery_date', tomorrow)
    .in('status', ['confirmado', 'aguardando_pagamento'])
    .order('display_id', { ascending: true })

  if (dbError) {
    console.error('[nightly-email] DB query failed', dbError.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const rows = (orders ?? []) as unknown as OrderRow[]

  // 3. Build Excel
  const headers = ['#', 'Nome', 'Telefone', 'Prato', 'Status']
  const dataRows = rows.map((o) => [
    o.display_id,
    o.customers?.name ?? '',
    o.customers?.phone ?? '',
    o.menu_items?.name ?? '',
    STATUS_LABELS[o.status] ?? o.status,
  ])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  // 4. Build subject
  const hasOrders = rows.length > 0
  const subject = hasOrders
    ? `Pedidos para amanhã — ${dateLabel}`
    : `Pedidos para amanhã — ${dateLabel} (nenhum pedido)`

  // 5. Send email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const laerteEmail = process.env.LAERTE_EMAIL
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@marmitadoseulaerte.com.br'

  try {
    await resend.emails.send({
      from: fromEmail,
      to: laerteEmail!,
      subject,
      text: hasOrders
        ? `Olá Seu Laerte! Aqui estão os ${rows.length} pedido(s) para amanhã (${dateLabel}). Veja o arquivo em anexo.`
        : `Olá Seu Laerte! Não há pedidos confirmados para amanhã (${dateLabel}).`,
      attachments: [
        {
          filename: `pedidos-${tomorrow}.xlsx`,
          content: xlsxBuffer,
        },
      ],
    })
  } catch (err: unknown) {
    console.error('[nightly-email] Resend failed', {
      date: tomorrow,
      error: err instanceof Error ? err.message : String(err),
    })

    // Fallback WhatsApp to Laerte (best-effort)
    const laertePhone = process.env.LAERTE_PHONE
    if (laertePhone) {
      sendMessage(
        laertePhone,
        '⚠️ Erro ao enviar o email com os pedidos. Verifique manualmente.',
      ).catch((msgErr: unknown) => {
        console.error('[nightly-email] Fallback WhatsApp also failed', {
          error: msgErr instanceof Error ? msgErr.message : String(msgErr),
        })
      })
    }

    return NextResponse.json({ error: 'Email failed' }, { status: 500 })
  }

  console.log('[nightly-email] Sent', { date: tomorrow, orderCount: rows.length })
  return NextResponse.json({ ok: true, date: tomorrow, orderCount: rows.length })
}
