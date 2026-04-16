import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando',
  confirmado: 'Confirmado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type OrderDetail = {
  display_id: string
  status: string
  customerName: string | null
  customerPhone: string
  dishName: string
}

async function getDayOrders(date: string): Promise<OrderDetail[]> {
  // Basic date format guard
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('orders')
    .select('display_id, status, customers(name, phone), menu_items(name)')
    .eq('delivery_date', date)
    .order('display_id', { ascending: true })

  if (error) {
    console.error('[admin/orders/date] fetch failed', error.message)
    return []
  }

  return (data ?? []).map((o) => {
    const customer = o.customers as unknown as { name: string | null; phone: string } | null
    const menuItem = o.menu_items as unknown as { name: string } | null
    return {
      display_id: o.display_id as string,
      status: o.status as string,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? '',
      dishName: menuItem?.name ?? '',
    }
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  params: Promise<{ date: string }>
}

export default async function AdminOrdersDayPage({ params }: Props) {
  const { date } = await params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

  const orders = await getDayOrders(date)
  const dateLabel = formatDate(date)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <Link
            href="/admin/orders"
            className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide hover:text-primary-foreground"
          >
            ← Semana
          </Link>
          <h1 className="text-lg font-bold capitalize">{dateLabel}</h1>
          <p className="text-sm text-primary-foreground/80">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {orders.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground text-sm">
            Nenhum pedido para este dia.
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {orders.map((order) => (
                <div key={order.display_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        #{order.display_id}
                        {order.customerName && (
                          <span className="font-normal text-muted-foreground">
                            {' '}— {order.customerName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.customerPhone}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.dishName}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
