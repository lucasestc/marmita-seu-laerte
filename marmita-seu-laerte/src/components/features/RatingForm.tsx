'use client'

import { useState, useTransition } from 'react'
import { StarRating } from '@/components/features/StarRating'
import { Button } from '@/components/ui/button'
import { submitRating } from '@/actions/ratings'

type Props = {
  orderId: number
}

export function RatingForm({ orderId }: Props) {
  const [stars, setStars] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (stars === 0) {
      setError('Selecione uma nota antes de enviar.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await submitRating(orderId, stars)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl" aria-hidden="true">🍱</span>
        <p className="font-bold text-lg text-foreground">Obrigado pela avaliação!</p>
        <p className="text-muted-foreground">Até amanhã.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <StarRating value={stars} onChange={setStars} disabled={isPending} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || stars === 0}
        className="min-h-[44px] px-10 font-semibold"
      >
        {isPending ? 'Enviando...' : 'Enviar avaliação'}
      </Button>
    </div>
  )
}
