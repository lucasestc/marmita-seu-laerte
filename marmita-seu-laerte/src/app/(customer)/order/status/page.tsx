import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Confirmado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'text-amber-600',
  confirmado: 'text-green-600',
  entregue: 'text-muted-foreground',
  cancelado: 'text-destructive',
}

function formatDeliveryDate(isoDate: string): string {
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

type LatestOrder = {
  displayId: string
  status: OrderStatus
  deliveryDate: string
  dishName: string
}

async function getLatestOrder(customerPhone: string): Promise<LatestOrder | null> {
  const supabase = createServiceClient()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customerPhone)
    .single()

  if (customerError || !customer) return null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('display_id, status, delivery_date, menu_items(name)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (orderError || !order) return null

  const menuItem = order.menu_items as unknown as { name: string } | null

  return {
    displayId: order.display_id as string,
    status: order.status as OrderStatus,
    deliveryDate: order.delivery_date as string,
    dishName: menuItem?.name ?? '—',
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OrderStatusPage() {
  const session = await getSession()
  if (!session) return null

  const order = await getLatestOrder(session.phone)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <h1 className="text-xl font-bold">Meu pedido</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {!order ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-muted-foreground">Você ainda não tem pedidos.</p>
            <Link
              href="/order"
              className={cn(buttonVariants({ variant: 'default' }), 'font-semibold')}
            >
              Ver cardápio
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              {/* Display ID */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Pedido</p>
                <p className="font-bold text-foreground">#{order.displayId}</p>
              </div>

              {/* Dish */}
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-muted-foreground">Prato</p>
                <p className="font-semibold text-foreground">{order.dishName}</p>
              </div>

              {/* Delivery date */}
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-muted-foreground">Entrega</p>
                <p className="text-sm text-foreground">{formatDeliveryDate(order.deliveryDate)}</p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <p className={cn('text-sm font-semibold', STATUS_COLORS[order.status])}>
                  {STATUS_LABELS[order.status]}
                </p>
              </div>
            </div>

            {/* CTA — go to checkout if awaiting payment */}
            {order.status === 'aguardando_pagamento' && (
              <Link
                href={`/checkout/${order.displayId}`}
                className={cn(buttonVariants({ variant: 'default' }), 'w-full min-h-[44px] font-semibold justify-center')}
              >
                Concluir pagamento
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
