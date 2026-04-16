import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { MenuDayCard } from '@/components/features/MenuDayCard'
import type { MenuItemWithSlots } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SLOTS_PER_DAY = 100

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Cardápio da Semana — Marmita do Seu Laerte',
  description:
    'Veja o cardápio desta semana e faça seu pedido de marmita caseira. Entrega no lobby da sua empresa em Faria Lima às 11h45.',
  openGraph: {
    title: 'Cardápio da Semana — Marmita do Seu Laerte',
    description:
      'Comida caseira de verdade, entregue no lobby da sua empresa. Faria Lima, todos os dias úteis às 11h45.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Marmita do Seu Laerte — cardápio semanal',
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Date helpers (Brasília timezone = America/Sao_Paulo = UTC-3)
// ---------------------------------------------------------------------------

/** Returns the ISO date string (YYYY-MM-DD) of the Monday of the current week in Brasília time. */
function getCurrentWeekMonday(): string {
  // toLocaleDateString with 'sv-SE' gives YYYY-MM-DD reliably
  const brasiliaDateStr = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  const [year, month, day] = brasiliaDateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  // JS getUTCDay(): 0 = Sunday, 1 = Monday … 6 = Saturday
  const dow = date.getUTCDay()
  const daysToMonday = dow === 0 ? 6 : dow - 1
  date.setUTCDate(date.getUTCDate() - daysToMonday)

  return date.toISOString().split('T')[0]
}

/** Returns a human-readable week range for the page header, e.g. "7 a 11 de abril de 2026". */
function formatWeekRange(weekStart: string): string {
  const monday = new Date(`${weekStart}T12:00:00Z`)
  const friday = new Date(monday)
  friday.setUTCDate(friday.getUTCDate() + 4)

  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('pt-BR', { ...opts, timeZone: 'America/Sao_Paulo' })

  const mondayMonth = monday.getUTCMonth()
  const fridayMonth = friday.getUTCMonth()

  if (mondayMonth === fridayMonth) {
    // "7 a 11 de abril de 2026"
    const startDay = fmt(monday, { day: 'numeric' })
    const endFull = fmt(friday, { day: 'numeric', month: 'long', year: 'numeric' })
    return `${startDay} a ${endFull}`
  }

  // "28 de abril a 2 de maio de 2026"
  const startFull = fmt(monday, { day: 'numeric', month: 'long' })
  const endFull = fmt(friday, { day: 'numeric', month: 'long', year: 'numeric' })
  return `${startFull} a ${endFull}`
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getMenuItems(weekStart: string): Promise<MenuItemWithSlots[] | null> {
  const supabase = await createServerClient()

  // Fetch this week's menu and its items in one round-trip
  const { data: menuWeek, error: menuError } = await supabase
    .from('menu_weeks')
    .select('id, menu_items(id, menu_week_id, delivery_date, name, description, morning_message, created_at, updated_at)')
    .eq('week_start', weekStart)
    .maybeSingle()

  if (menuError) {
    console.error('[menu/page] menu_weeks query failed', menuError.message)
    return null
  }

  if (!menuWeek?.menu_items?.length) return null

  // Sort by delivery date (Mon → Fri)
  const items = [...menuWeek.menu_items].sort((a, b) =>
    a.delivery_date.localeCompare(b.delivery_date),
  )

  const dates = items.map((item) => item.delivery_date)

  // Count confirmed orders per delivery date for live slot display
  const { data: confirmedOrders, error: ordersError } = await supabase
    .from('orders')
    .select('delivery_date')
    .in('delivery_date', dates)
    .eq('status', 'confirmado')

  if (ordersError) {
    // Non-fatal: render menu with full capacity if order count unavailable
    console.error('[menu/page] orders query failed', ordersError.message)
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
      availableSlots: Math.max(0, MAX_SLOTS_PER_DAY - confirmedCount),
    }
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MenuPage() {
  const weekStart = getCurrentWeekMonday()
  const [items, weekRange] = await Promise.all([
    getMenuItems(weekStart),
    Promise.resolve(formatWeekRange(weekStart)),
  ])

  return (
    <div className="min-h-screen bg-background">
      {/* Terracotta brand header */}
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

      {/* Menu cards */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {items ? (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <MenuDayCard key={item.id} item={item} orderHref="/order" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground">
              O cardápio desta semana ainda não foi publicado. Volte em breve!
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
