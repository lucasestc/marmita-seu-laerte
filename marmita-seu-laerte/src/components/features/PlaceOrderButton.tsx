'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { placeOrder } from '@/actions/orders'

type Props = {
  menuItemId: number
  deliveryDate: string
}

/**
 * Authenticated "Fazer pedido" button.
 * Calls the placeOrder Server Action; on success the action redirects to
 * /checkout/[displayId] so this component never sees a success return.
 * On failure it renders the error beneath the button.
 */
export function PlaceOrderButton({ menuItemId, deliveryDate }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await placeOrder(menuItemId, deliveryDate)
      // Only reached on failure — success redirects away
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full min-h-[44px] font-semibold"
      >
        {isPending ? 'Reservando…' : 'Fazer pedido'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive text-center">
          {error}
        </p>
      )}
    </div>
  )
}
