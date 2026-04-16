'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cancelOrder } from '@/actions/orders'

type Props = {
  orderId: number
  onCancelled: () => void
}

/**
 * Two-step cancel button: first tap reveals an inline confirm row,
 * second tap fires the server action. Avoids browser confirm() dialogs
 * which are blocked on some mobile browsers and disrupt the UX flow.
 */
export function CancelOrderButton({ orderId, onCancelled }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFirstTap() {
    setError(null)
    setConfirming(true)
  }

  function handleAbort() {
    setConfirming(false)
    setError(null)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await cancelOrder(orderId)
      if (!result.success) {
        setError(result.error)
        setConfirming(false)
        return
      }
      onCancelled()
    })
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">Tem certeza que deseja cancelar?</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex w-full gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={handleAbort}
            disabled={isPending}
          >
            Não
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1 min-h-[44px] font-semibold"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Cancelando...' : 'Sim, cancelar'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full min-h-[44px] text-muted-foreground hover:text-destructive"
      onClick={handleFirstTap}
    >
      Cancelar pedido
    </Button>
  )
}
