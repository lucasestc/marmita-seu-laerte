import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { mondayOfWeek } from '@/lib/date-helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAPACITY = 100

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type DayCount = {
  date: string
  weekday: string
  confirmed: number
  remaining: number
  soldOut: boolean
}

async function getWeekCounts(): Promise<DayCount[]> {
  const supabase = createServiceClient()

  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  const monday = mondayOfWeek(todayBrasilia)
  const friday = addDays(monday, 4)

  const { data, error } = await supabase
    .from('orders')
    .select('delivery_date')
    .gte('delivery_date', monday)
    .lte('delivery_date', friday)
    .eq('status', 'confirmado')

  if (error) {
    console.error('[admin/orders] fetch failed', error.message)
    return []
  }

  // Count per date
  const counts: Record<string, number> = {}
  for (let i = 0; i <= 4; i++) {
    counts[addDays(monday, i)] = 0
  }
  for (const row of data ?? []) {
    const d = row.delivery_date as string
    if (d in counts) counts[d]++
  }

  return Object.entries(counts).map(([date, confirmed]) => {
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
    return {
      date,
      weekday: WEEKDAY_LABELS[dow] ?? date,
      confirmed,
      remaining: Math.max(0, CAPACITY - confirmed),
      soldOut: confirmed >= CAPACITY,
    }
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminOrdersPage() {
  const days = await getWeekCounts()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
            Admin
          </p>
          <h1 className="text-lg font-bold">Pedidos da semana</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {days.map((day) => (
              <Link
                key={day.date}
                href={`/admin/orders/${day.date}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-semibold text-foreground">{day.weekday}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
                </div>
                <div className="text-right">
                  {day.soldOut ? (
                    <span className="inline-block rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
                      Esgotado
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">
                      {day.confirmed}
                      <span className="text-muted-foreground font-normal"> / {CAPACITY}</span>
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {day.remaining} restante{day.remaining !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
