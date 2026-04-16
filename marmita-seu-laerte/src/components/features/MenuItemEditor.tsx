'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateMenuItem } from '@/actions/menu'
import type { MenuItem } from '@/types/app.types'

type Props = {
  item: MenuItem
  dayLabel: string
}

/**
 * Inline editor for a single menu item.
 * Shows item name/description with an "Editar" toggle, then a small form.
 */
export function MenuItemEditor({ item, dayLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateMenuItem(item.id, name, description || undefined)
      if (result.success) {
        setEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  function handleCancel() {
    setName(item.name)
    setDescription(item.description ?? '')
    setError(null)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{dayLabel}</p>
          <p className="font-semibold text-foreground truncate">{name}</p>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setEditing(true)}
        >
          Editar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{dayLabel}</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`name-${item.id}`} className="text-sm">
          Nome do prato
        </Label>
        <Input
          id={`name-${item.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          placeholder="Ex: Frango grelhado com arroz e feijão"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`desc-${item.id}`} className="text-sm">
          Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id={`desc-${item.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          placeholder="Ex: Com salada, arroz e feijão"
          className="h-9"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
