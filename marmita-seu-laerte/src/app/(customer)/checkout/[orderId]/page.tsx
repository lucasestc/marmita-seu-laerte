import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { PixSection } from '@/components/features/PixSection'
import type { OrderStatus } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Metadata — this page must not be indexed (personal payment data)
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Checkout — Marmita do Seu Laerte',
  robots: { index: false, follow: false },
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARMITA_PRICE = 'R$\u00A035,00'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutOrder = {
  id: number
  displayId: string
  status: OrderStatus
  deliveryDate: string
  pixKey: string | null
  pixExpiresAt: string | null
  createdAt: string
  dishName: string
  dishDescription: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDeliveryDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

/** Returns the weekday name without "-feira", lowercase, e.g. "quinta" */
function weekdayName(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return date
    .toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })
    .replace('-feira', '')
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getCheckoutOrder(
  displayId: string,
  customerPhone: string,
): Promise<CheckoutOrder | null> {
  const supabase = createServiceClient()

  // Resolve customer.id from session phone
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customerPhone)
    .single()

  if (customerError || !customer) return null

  // Fetch order — enforce customer ownership via customer_id filter
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, display_id, status, delivery_date, pix_key, pix_expires_at, created_at, menu_items(name, description)',
    )
    .eq('display_id', displayId)
    .eq('customer_id', customer.id)
    .single()

  if (orderError || !order) return null

  const menuItem = order.menu_items as unknown as { name: string; description: string | null } | null
  if (!menuItem) return null

  // Initialize pix_expires_at (and pix_key) on first checkout visit
  let pixExpiresAt = order.pix_expires_at as string | null
  let pixKey = order.pix_key as string | null

  if (order.status === 'aguardando_pagamento' && !pixExpiresAt) {
    const expiresAt = new Date(
      new Date(order.created_at as string).getTime() + 30 * 60 * 1000,
    ).toISOString()
    const envPixKey = process.env.PIX_KEY ?? null

    const { error: updateError } = await supabase
      .from('orders')
      .update({ pix_expires_at: expiresAt, pix_key: envPixKey })
      .eq('id', order.id)

    if (!updateError) {
      pixExpiresAt = expiresAt
      pixKey = envPixKey
    }
  }

  return {
    id: order.id as number,
    displayId: order.display_id as string,
    status: order.status as OrderStatus,
    deliveryDate: order.delivery_date as string,
    pixKey,
    pixExpiresAt,
    createdAt: order.created_at as string,
    dishName: menuItem.name,
    dishDescription: menuItem.description,
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  params: Promise<{ orderId: string }>
}

export default async function CheckoutPage({ params }: Props) {
  const { orderId } = await params
  const session = await getSession()

  // Proxy should guard this route, but defend in depth
  if (!session) notFound()

  const order = await getCheckoutOrder(orderId, session.phone)
  if (!order) notFound()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-lg flex-col px-4 py-5">
          <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
            Pedido
          </p>
          <h1 className="text-xl font-bold">#{order.displayId}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Order summary */}
        <section className="rounded-xl border border-border bg-card p-4 mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {formatDeliveryDate(order.deliveryDate)}
          </p>
          <p className="font-bold text-lg leading-snug">{order.dishName}</p>
          {order.dishDescription && (
            <p className="text-sm text-muted-foreground mt-0.5">{order.dishDescription}</p>
          )}
          <p className="mt-3 text-sm font-semibold text-foreground">{MARMITA_PRICE}</p>
        </section>

        {/* Status-based content */}
        <OrderStatusContent order={order} />
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status-based content (Server Component)
// ---------------------------------------------------------------------------

function OrderStatusContent({ order }: { order: CheckoutOrder }) {
  if (order.status === 'aguardando_pagamento') {
    const initiallyExpired =
      order.pixExpiresAt === null || new Date(order.pixExpiresAt) <= new Date()

    return (
      <PixSection
        orderId={order.id}
        pixKey={order.pixKey ?? ''}
        initialExpiresAt={order.pixExpiresAt ?? new Date(0).toISOString()}
        initiallyExpired={initiallyExpired}
      />
    )
  }

  if (order.status === 'confirmado') {
    const day = weekdayName(order.deliveryDate)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl" aria-hidden="true">🍱</span>
        <p className="font-bold text-lg text-foreground">Pedido confirmado!</p>
        <p className="text-muted-foreground">
          Nos vemos na {day} às 11h45 no lobby.
        </p>
      </div>
    )
  }

  if (order.status === 'cancelado') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-semibold text-foreground">Pedido cancelado.</p>
        <p className="text-sm text-muted-foreground">
          Esperamos te ver em breve! 🍱
        </p>
      </div>
    )
  }

  if (order.status === 'entregue') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl" aria-hidden="true">✅</span>
        <p className="font-bold text-foreground">Pedido entregue. Bom apetite!</p>
      </div>
    )
  }

  return null
}

