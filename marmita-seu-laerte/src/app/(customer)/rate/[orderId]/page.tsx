import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { RatingForm } from '@/components/features/RatingForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Avaliar pedido — Marmita do Seu Laerte',
  robots: { index: false, follow: false },
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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type RatingOrder = {
  id: number
  deliveryDate: string
  dishName: string
  alreadyRated: boolean
}

async function getRatingOrder(
  displayId: string,
  customerPhone: string,
): Promise<RatingOrder | null> {
  const supabase = createServiceClient()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customerPhone)
    .single()

  if (customerError || !customer) return null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, delivery_date, menu_items(name), ratings(id)')
    .eq('display_id', displayId)
    .eq('customer_id', customer.id as number)
    .single()

  if (orderError || !order) return null

  const menuItem = order.menu_items as unknown as { name: string } | null
  if (!menuItem) return null

  const ratings = order.ratings as unknown as { id: number }[] | null
  const alreadyRated = Array.isArray(ratings) && ratings.length > 0

  return {
    id: order.id as number,
    deliveryDate: order.delivery_date as string,
    dishName: menuItem.name,
    alreadyRated,
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  params: Promise<{ orderId: string }>
}

export default async function RatePage({ params }: Props) {
  const { orderId } = await params
  const session = await getSession()

  if (!session) notFound()

  const order = await getRatingOrder(orderId, session.phone)
  if (!order) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
            Avaliação
          </p>
          <h1 className="text-xl font-bold">{order.dishName}</h1>
          <p className="text-sm text-primary-foreground/80 capitalize">
            {formatDeliveryDate(order.deliveryDate)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {order.alreadyRated ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-semibold text-foreground">Você já avaliou este pedido.</p>
            <p className="text-sm text-muted-foreground">Obrigado pelo feedback! 🍱</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground text-center">
              Como você avalia o prato de hoje?
            </p>
            <RatingForm orderId={order.id} />
          </div>
        )}
      </main>
    </div>
  )
}
