import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { MenuItemEditor } from '@/components/features/MenuItemEditor'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/types/app.types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WeekWithItems = {
  id: number
  week_start: string
  menu_items: MenuItem[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

function weekdayName(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return WEEKDAY_NAMES[date.getUTCDay()] ?? isoDate
}

function formatWeekRange(weekStart: string): string {
  const monday = new Date(`${weekStart}T12:00:00Z`)
  const friday = new Date(monday)
  friday.setUTCDate(friday.getUTCDate() + 4)

  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Sao_Paulo',
    })

  return `${fmt(monday)} – ${fmt(friday)}`
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getWeeks(): Promise<WeekWithItems[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('menu_weeks')
    .select(
      'id, week_start, menu_items(id, menu_week_id, delivery_date, name, description, morning_message, created_at, updated_at)',
    )
    .order('week_start', { ascending: false })
    .limit(12)

  if (error) {
    console.error('[admin/menu] fetch weeks failed', error.message)
    return []
  }

  return (data ?? []).map((w) => ({
    ...w,
    menu_items: [...(w.menu_items ?? [])].sort((a, b) =>
      a.delivery_date.localeCompare(b.delivery_date),
    ),
  }))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminMenuPage() {
  const weeks = await getWeeks()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-5">
          <div>
            <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
              Admin
            </p>
            <h1 className="text-lg font-bold">Cardápios</h1>
          </div>
          <Link
            href="/admin/menu/nova-semana"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              'font-semibold',
            )}
          >
            + Nova semana
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {weeks.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-muted-foreground">Nenhum cardápio publicado ainda.</p>
            <Link
              href="/admin/menu/nova-semana"
              className={cn(buttonVariants({ variant: 'default' }), 'font-semibold')}
            >
              Criar primeiro cardápio
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {weeks.map((week) => (
              <section
                key={week.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Week header */}
                <div className="bg-muted/50 px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">
                    {formatWeekRange(week.week_start)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {week.menu_items.length} prato{week.menu_items.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Items */}
                <div className="divide-y divide-border px-4">
                  {week.menu_items.map((item) => (
                    <MenuItemEditor
                      key={item.id}
                      item={item}
                      dayLabel={weekdayName(item.delivery_date)}
                    />
                  ))}
                  {week.menu_items.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">Sem pratos cadastrados.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
