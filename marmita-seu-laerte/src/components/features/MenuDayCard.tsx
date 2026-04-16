import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { MenuItemWithSlots } from '@/types/app.types'

const MAX_SLOTS = 100

type MenuDayCardProps = {
  item: MenuItemWithSlots
  /**
   * Href for the "Fazer pedido" CTA.
   * Story 2.1 default: '/login' (ordering not yet built).
   * Story 3 will pass the real order URL per day.
   */
  orderHref?: string
}

/** Format an ISO date string into a Portuguese day label, e.g. "Segunda · 7 de abril". */
function formatDayLabel(deliveryDate: string): string {
  // Use noon UTC to avoid any off-by-one from timezone shifts
  const date = new Date(`${deliveryDate}T12:00:00Z`)

  const weekday = date
    .toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })
    .replace('-feira', '') // "segunda-feira" → "segunda"

  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  const dayMonth = date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })

  return `${capitalized} · ${dayMonth}`
}

/**
 * MenuDayCard — displays a single delivery-day dish with availability and an order CTA.
 *
 * States:
 *   available  — shows slot count in amber and a "Fazer pedido" link
 *   sold-out   — card dimmed, CTA replaced by a disabled "Esgotado" label
 *
 * Server Component: no interactivity. Story 3 will add the order flow.
 */
export function MenuDayCard({ item, orderHref = '/login' }: MenuDayCardProps) {
  const isSoldOut = item.availableSlots <= 0
  const dayLabel = formatDayLabel(item.delivery_date)
  const slotLabel =
    item.availableSlots === 1 ? '1 vaga restante' : `${item.availableSlots} vagas restantes`

  return (
    <article
      role="article"
      aria-label={`Prato de ${dayLabel}: ${item.name}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        isSoldOut && 'opacity-50',
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
        {isSoldOut ? (
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
            <a
              href={orderHref}
              className={cn(buttonVariants({ variant: 'default' }), 'w-full min-h-[44px] justify-center')}
            >
              Fazer pedido
            </a>
          </>
        )}
      </div>
    </article>
  )
}
