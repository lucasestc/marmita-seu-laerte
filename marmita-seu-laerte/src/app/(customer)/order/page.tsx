import { createServiceClient } from '@/lib/supabase/server'
import { PlaceOrderButton } from '@/components/features/PlaceOrderButton'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { MenuItem } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SLOTS = 100

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderDayItem = MenuItem & {
  confirmedOrders: number
  availableSlots: number
  isPastCutoff: boolean
}

// ---------------------------------------------------------------------------
// Date helpers (Brasília = America/Sao_Paulo)
// ---------------------------------------------------------------------------

function getCurrentWeekMonday(): string {
  const brasiliaDateStr = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  const [year, month, day] = brasiliaDateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dow = date.getUTCDay()
  const daysToMonday = dow === 0 ? 6 : dow - 1
  date.setUTCDate(date.getUTCDate() - daysToMonday)
  return date.toISOString().split('T')[0]
}

function getTodayBrasilia(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function formatWeekRange(weekStart: string): string {
  const monday = new Date(`${weekStart}T12:00:00Z`)
  const friday = new Date(monday)
  friday.setUTCDate(friday.getUTCDate() + 4)
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('pt-BR', { ...opts, timeZone: 'America/Sao_Paulo' })
  const mondayMonth = monday.getUTCMonth()
  const fridayMonth = friday.getUTCMonth()
  if (mondayMonth === fridayMonth) {
    return `${fmt(monday, { day: 'numeric' })} a ${fmt(friday, { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  return `${fmt(monday, { day: 'numeric', month: 'long' })} a ${fmt(friday, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function formatDayLabel(deliveryDate: string): string {
  const date = new Date(`${deliveryDate}T12:00:00Z`)
  const weekday = date
    .toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })
    .replace('-feira', '')
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const dayMonth = date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
  return `${capitalized} · ${dayMonth}`
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getOrderDayItems(
  weekStart: string,
  todayBrasilia: string,
): Promise<OrderDayItem[] | null> {
  const supabase = createServiceClient()

  const { data: menuWeek, error: menuError } = await supabase
    .from('menu_weeks')
    .select(
      'id, menu_items(id, menu_week_id, delivery_date, name, description, morning_message, created_at, updated_at)',
    )
    .eq('week_start', weekStart)
    .maybeSingle()

  if (menuError) {
    console.error('[order/page] menu_weeks query failed', menuError.message)
    return null
  }

  if (!menuWeek?.menu_items?.length) return null

  const items = [...menuWeek.menu_items].sort((a, b) =>
    a.delivery_date.localeCompare(b.delivery_date),
  )

  const dates = items.map((item) => item.delivery_date)

  // Count confirmed orders per date for slot display
  const { data: confirmedOrders, error: ordersError } = await supabase
    .from('orders')
    .select('delivery_date')
    .in('delivery_date', dates)
    .eq('status', 'confirmado')

  if (ordersError) {
    console.error('[order/page] orders query failed', ordersError.message)
  }

  const countMap = new Map<string, number>(dates.map((d) => [d, 0]))
  confirmedOrders?.forEach((o) => {
    countMap.set(o.delivery_date, (countMap.get(o.delivery_date) ?? 0) + 1)
  })

  return items.map((item) => {
    const confirmedCount = countMap.get(item.delivery_date) ?? 0
    return {
      ...item,
      confirmedOrders: confirmedCount,
      availableSlots: Math.max(0, MAX_SLOTS - confirmedCount),
      // Cutoff: delivery date = today or earlier → closed
      isPastCutoff: item.delivery_date <= todayBrasilia,
    }
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function OrderPage() {
  const weekStart = getCurrentWeekMonday()
  const todayBrasilia = getTodayBrasilia()
  const items = await getOrderDayItems(weekStart, todayBrasilia)
  const weekRange = formatWeekRange(weekStart)

  return (
    <div className="min-h-screen bg-background">
      {/* Brand header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-8 text-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/10"
            aria-hidden="true"
          >
            <span className="text-3xl">🍱</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Marmita do Seu Laerte</h1>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Cardápio da semana · {weekRange}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {!items ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground">
              O cardápio desta semana ainda não foi publicado. Volte em breve!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <OrderDayCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OrderDayCard — server-rendered shell with interactive CTA
// ---------------------------------------------------------------------------

function OrderDayCard({ item }: { item: OrderDayItem }) {
  const isSoldOut = item.availableSlots <= 0
  const dayLabel = formatDayLabel(item.delivery_date)

  const slotLabel =
    item.availableSlots === 1
      ? '1 vaga restante'
      : `${item.availableSlots} vagas restantes`

  return (
    <article
      role="article"
      aria-label={`Prato de ${dayLabel}: ${item.name}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        (isSoldOut || item.isPastCutoff) && 'opacity-50',
      )}
    >
      {/* Day label */}
      <p className="text-sm font-semibold text-muted-foreground">{dayLabel}</p>

      {/* Dish info */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold leading-snug text-foreground">{item.name}</h2>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>

      {/* Availability + CTA */}
      <div className="mt-auto flex flex-col gap-2">
        {item.isPastCutoff ? (
          <p className="text-sm text-muted-foreground">Reservas encerradas</p>
        ) : isSoldOut ? (
          <>
            <p className="text-sm text-muted-foreground">Esgotado</p>
            <span
              className={cn(
                buttonVariants({ variant: 'default' }),
                'w-full cursor-not-allowed opacity-50 justify-center',
              )}
              aria-disabled="true"
            >
              Esgotado
            </span>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-amber-600">{slotLabel}</p>
            <PlaceOrderButton
              menuItemId={item.id}
              deliveryDate={item.delivery_date}
            />
          </>
        )}
      </div>
    </article>
  )
}
