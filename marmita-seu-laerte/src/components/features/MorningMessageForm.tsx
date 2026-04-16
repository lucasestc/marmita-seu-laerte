'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateMorningMessage } from '@/actions/menu'
import type { MenuItem } from '@/types/app.types'

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return WEEKDAY_LABELS[date.getUTCDay()] ?? isoDate
}

type ItemRowProps = {
  item: MenuItem
}

function MorningMessageRow({ item }: ItemRowProps) {
  const [value, setValue] = useState(item.morning_message ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateMorningMessage(item.id, value.trim() || null)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-border last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {weekdayLabel(item.delivery_date)}
        </span>
        <span className="text-xs text-muted-foreground">{item.name}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Hoje tem ${item.name}! ${item.description ?? ''}`.trim()}
        rows={3}
        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant={saved ? 'secondary' : 'default'}
        disabled={isPending}
        onClick={handleSave}
        className="self-end min-h-[36px] px-5 font-semibold"
      >
        {saved ? 'Salvo!' : isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  )
}

type Props = {
  items: MenuItem[]
}

export function MorningMessageForm({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground text-center">
        Nenhum prato cadastrado para a semana atual.
      </p>
    )
  }

  return (
    <div className="divide-y-0">
      {items.map((item) => (
        <MorningMessageRow key={item.id} item={item} />
      ))}
    </div>
  )
}
