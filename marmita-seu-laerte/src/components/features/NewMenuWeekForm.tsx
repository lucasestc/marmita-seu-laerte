'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMenuWeek } from '@/actions/menu'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

/** Given a Monday ISO date string, return the 5 weekday ISO date strings. */
function getWeekdayDates(monday: string): string[] {
  const base = new Date(`${monday}T12:00:00Z`)
  return WEEKDAYS.map((_, i) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })
}

/** Return the ISO date of the Monday that is >= today (or next Monday if today is Sat/Sun). */
function getDefaultMonday(): string {
  const now = new Date()
  const brasiliaStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [y, m, d] = brasiliaStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() // 0=Sun 1=Mon … 6=Sat
  // Move to next Monday if today is not Monday
  const daysToNext = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow
  date.setUTCDate(date.getUTCDate() + daysToNext)
  return date.toISOString().split('T')[0]
}

/** Format an ISO date as "Seg, 14/04" etc. */
function shortDayLabel(isoDate: string, weekdayName: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const day = date.getUTCDate().toString().padStart(2, '0')
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${weekdayName}, ${day}/${month}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type DayItem = {
  name: string
  description: string
}

export function NewMenuWeekForm() {
  const router = useRouter()
  const [monday, setMonday] = useState(getDefaultMonday)
  const [days, setDays] = useState<DayItem[]>(() =>
    WEEKDAYS.map(() => ({ name: '', description: '' })),
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const weekdayDates = getWeekdayDates(monday)

  function updateDay(index: number, field: keyof DayItem, value: string) {
    setDays((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function handleMondayChange(value: string) {
    // Snap to the Monday of the selected week
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = date.getUTCDay()
    const toMonday = dow === 0 ? -6 : 1 - dow
    date.setUTCDate(date.getUTCDate() + toMonday)
    setMonday(date.toISOString().split('T')[0])
  }

  function handleSubmit() {
    setError(null)

    // Build items — skip rows where name is completely empty
    const items = days
      .map((day, i) => ({
        delivery_date: weekdayDates[i],
        name: day.name.trim(),
        description: day.description.trim() || undefined,
      }))
      .filter((item) => item.name.length > 0)

    if (items.length === 0) {
      setError('Adicione pelo menos um prato.')
      return
    }

    startTransition(async () => {
      const result = await createMenuWeek({ week_start: monday, items })
      if (result.success) {
        router.push('/admin/menu')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Week picker */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="week-start" className="text-sm font-medium">
          Semana (selecione qualquer dia — ajusta para segunda)
        </Label>
        <Input
          id="week-start"
          type="date"
          value={monday}
          onChange={(e) => handleMondayChange(e.target.value)}
          disabled={isPending}
          className="h-10 max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Semana de {monday.split('-').reverse().join('/')}
        </p>
      </div>

      {/* Daily items */}
      <div className="flex flex-col gap-4">
        {WEEKDAYS.map((weekday, i) => (
          <div key={weekdayDates[i]} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-muted-foreground">
              {shortDayLabel(weekdayDates[i], weekday)}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`name-${i}`} className="text-xs">
                Nome do prato
              </Label>
              <Input
                id={`name-${i}`}
                value={days[i].name}
                onChange={(e) => updateDay(i, 'name', e.target.value)}
                disabled={isPending}
                placeholder="Ex: Frango assado com arroz e feijão"
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`desc-${i}`} className="text-xs">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id={`desc-${i}`}
                value={days[i].description}
                onChange={(e) => updateDay(i, 'description', e.target.value)}
                disabled={isPending}
                placeholder="Ex: Acompanha salada e farofa"
                className="h-9"
              />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive rounded-lg bg-destructive/8 px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 h-11 font-semibold"
        >
          {isPending ? 'Salvando…' : 'Publicar cardápio'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/menu')}
          disabled={isPending}
          className="h-11"
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
