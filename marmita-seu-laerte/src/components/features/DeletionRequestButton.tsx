'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { requestDeletion } from '@/actions/ratings'

export function DeletionRequestButton() {
  const [done, setDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFirstTap() {
    setConfirming(true)
  }

  function handleAbort() {
    setConfirming(false)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await requestDeletion()
      if (!result.success) {
        setError(result.error)
        setConfirming(false)
        return
      }
      setDone(true)
    })
  }

  if (done) {
    return (
      <p className="text-sm text-foreground text-center py-4">
        Solicitação recebida. Seus dados serão excluídos em até 15 dias úteis.
      </p>
    )
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground text-center">
          Tem certeza? Esta ação não pode ser desfeita.
        </p>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={handleAbort}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1 min-h-[44px] font-semibold"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Enviando...' : 'Confirmar exclusão'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="destructive"
      className="w-full min-h-[44px] font-semibold"
      onClick={handleFirstTap}
    >
      Solicitar exclusão dos meus dados
    </Button>
  )
}
