import { createServiceClient } from '@/lib/supabase/server'
import { MorningMessageForm } from '@/components/features/MorningMessageForm'
import { mondayOfWeek } from '@/lib/date-helpers'
import type { MenuItem } from '@/types/app.types'

export const dynamic = 'force-dynamic'

/** Adds 7 days to an ISO date string. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type NotificationsData = {
  currentWeekItems: MenuItem[]
  nextWeekItems: Pick<MenuItem, 'delivery_date' | 'name'>[]
}

async function getData(): Promise<NotificationsData> {
  const supabase = createServiceClient()

  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })

  const currentMonday = mondayOfWeek(todayBrasilia)
  const nextMonday = addDays(currentMonday, 7)
  const nextNextMonday = addDays(nextMonday, 7)

  const [currentRes, nextRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, menu_week_id, delivery_date, name, description, morning_message, created_at, updated_at')
      .gte('delivery_date', currentMonday)
      .lt('delivery_date', nextMonday)
      .order('delivery_date', { ascending: true }),
    supabase
      .from('menu_items')
      .select('delivery_date, name')
      .gte('delivery_date', nextMonday)
      .lt('delivery_date', nextNextMonday)
      .order('delivery_date', { ascending: true }),
  ])

  return {
    currentWeekItems: (currentRes.data ?? []) as unknown as MenuItem[],
    nextWeekItems: (nextRes.data ?? []) as Pick<MenuItem, 'delivery_date' | 'name'>[],
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminNotificationsPage() {
  const { currentWeekItems, nextWeekItems } = await getData()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '[URL do app]'

  // Build menu reveal preview
  const revealLines = nextWeekItems
    .map((item) => {
      const date = new Date(`${item.delivery_date}T12:00:00Z`)
      const label = WEEKDAY_LABELS[date.getUTCDay()] ?? item.delivery_date
      return `${label}: ${item.name}`
    })
    .join('\n')

  const revealPreview =
    nextWeekItems.length > 0
      ? `📋 Cardápio da semana!\n\n${revealLines}\n\nFaça seu pedido em ${appUrl}`
      : null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
            Admin
          </p>
          <h1 className="text-lg font-bold">Notificações</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-8">
        {/* Morning messages */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Mensagem matinal
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enviada às 8h para clientes com pedido confirmado no dia.
            Se vazio, usa o nome e descrição do prato.
          </p>
          <div className="rounded-2xl border border-border bg-card px-4">
            <MorningMessageForm items={currentWeekItems} />
          </div>
        </section>

        {/* Sunday reveal preview */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Prévia — Revelação de domingo
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enviada às 20h no domingo para todos os clientes com consentimento.
          </p>
          <div className="rounded-2xl border border-border bg-card p-4">
            {revealPreview ? (
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {revealPreview}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum cardápio cadastrado para a próxima semana.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
