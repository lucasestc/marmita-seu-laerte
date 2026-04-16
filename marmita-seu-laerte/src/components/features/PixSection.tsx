'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CountdownTimer } from '@/components/features/CountdownTimer'
import { CopyPixButton } from '@/components/features/CopyPixButton'
import { CancelOrderButton } from '@/components/features/CancelOrderButton'
import { renewPixExpiry } from '@/actions/orders'

const MARMITA_PRICE = 'R$\u00A035,00'

type Props = {
  orderId: number
  pixKey: string
  initialExpiresAt: string
  /** True when the server already determined the timer is expired on initial render. */
  initiallyExpired: boolean
}

/**
 * Client component that manages the active / expired Pix payment state for
 * orders with status `aguardando_pagamento`.
 *
 * - When the timer reaches 00:00 it transitions to the expired view without
 *   a page reload (Story 3.3 AC: "without requiring a page reload").
 * - "Gerar novo Pix" calls the renewPixExpiry server action and, on success,
 *   resets the timer with the fresh expiry returned from the server.
 * - "Cancelar pedido" shows a two-step confirm inline, then redirects to
 *   /order/status on success (Story 3.4).
 */
export function PixSection({ orderId, pixKey, initialExpiresAt, initiallyExpired }: Props) {
  const router = useRouter()
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [isExpired, setIsExpired] = useState(initiallyExpired)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExpire() {
    setIsExpired(true)
  }

  function handleRenew() {
    setRenewError(null)
    startTransition(async () => {
      const result = await renewPixExpiry(orderId)
      if (!result.success) {
        setRenewError(result.error)
        return
      }
      setExpiresAt(result.data!.newExpiresAt)
      setIsExpired(false)
    })
  }

  function handleCancelled() {
    // Refresh server data in place — checkout page re-renders with cancelado
    // status, showing "Pedido cancelado." on the same URL (Story 3.4 AC).
    router.refresh()
  }

  if (isExpired) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="font-semibold text-foreground">Seu tempo para pagar expirou.</p>
        {renewError && (
          <p className="text-sm text-destructive">{renewError}</p>
        )}
        <Button
          type="button"
          onClick={handleRenew}
          disabled={isPending}
          className="min-h-[44px] px-8 font-semibold"
        >
          {isPending ? 'Gerando...' : 'Gerar novo Pix'}
        </Button>
        <CancelOrderButton orderId={orderId} onCancelled={handleCancelled} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Countdown */}
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">Tempo restante para pagar</p>
        <CountdownTimer expiresAt={expiresAt} onExpire={handleExpire} />
      </div>

      {/* Pix key */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-muted-foreground">Chave Pix</p>
        <p className="font-mono text-base font-semibold text-foreground break-all select-all">
          {pixKey}
        </p>
        <p className="text-xs text-muted-foreground">
          Pague exatamente {MARMITA_PRICE} — qualquer valor diferente não será confirmado.
        </p>
      </div>

      {/* Copy button */}
      <CopyPixButton pixKey={pixKey} />

      {/* Cancel */}
      <CancelOrderButton orderId={orderId} onCancelled={handleCancelled} />
    </div>
  )
}
