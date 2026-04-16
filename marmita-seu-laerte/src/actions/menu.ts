'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { ActionResult } from '@/types/app.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertAdmin(): Promise<{ phone: string } | null> {
  const session = await getSession()
  if (!session) return null
  const adminPhone = process.env.LAERTE_PHONE
  if (!adminPhone || session.phone !== adminPhone) return null
  return session
}

// ---------------------------------------------------------------------------
// createMenuWeek
// ---------------------------------------------------------------------------

const menuItemInputSchema = z.object({
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de entrega inválida.'),
  name: z.string().min(1, 'O nome do prato é obrigatório.'),
  description: z.string().optional(),
})

const createMenuWeekSchema = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início de semana inválida.'),
  items: z
    .array(menuItemInputSchema)
    .min(1, 'Adicione pelo menos um prato.')
    .max(5),
})

export type CreateMenuWeekInput = {
  week_start: string
  items: { delivery_date: string; name: string; description?: string }[]
}

/**
 * Create a new menu week with up to 5 daily items.
 * Requires admin session (LAERTE_PHONE).
 */
export async function createMenuWeek(
  input: CreateMenuWeekInput,
): Promise<ActionResult<{ weekId: number }>> {
  if (!(await assertAdmin())) {
    return { success: false, error: 'Não autorizado.' }
  }

  const parsed = createMenuWeekSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { success: false, error: message }
  }

  const { week_start, items } = parsed.data
  const supabase = createServiceClient()

  const { data: week, error: weekError } = await supabase
    .from('menu_weeks')
    .insert({ week_start })
    .select('id')
    .single()

  if (weekError || !week) {
    console.error('[createMenuWeek] insert week failed', weekError?.message)
    if (weekError?.code === '23505') {
      return { success: false, error: 'Já existe um cardápio para esta semana.' }
    }
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  const { error: itemsError } = await supabase.from('menu_items').insert(
    items.map((item) => ({
      menu_week_id: week.id,
      delivery_date: item.delivery_date,
      name: item.name,
      description: item.description ?? null,
    })),
  )

  if (itemsError) {
    console.error('[createMenuWeek] insert items failed', itemsError.message)
    // Best-effort cleanup of the orphaned week row
    await supabase.from('menu_weeks').delete().eq('id', week.id)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/menu')
  revalidatePath('/admin/menu')

  return { success: true, data: { weekId: week.id } }
}

// ---------------------------------------------------------------------------
// updateMenuItem
// ---------------------------------------------------------------------------

const updateMenuItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, 'O nome do prato é obrigatório.'),
  description: z.string().optional(),
})

/**
 * Update the name and/or description of a single menu item.
 * Requires admin session (LAERTE_PHONE).
 */
export async function updateMenuItem(
  id: number,
  name: string,
  description?: string,
): Promise<ActionResult> {
  if (!(await assertAdmin())) {
    return { success: false, error: 'Não autorizado.' }
  }

  const parsed = updateMenuItemSchema.safeParse({ id, name, description })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { success: false, error: message }
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('menu_items')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('[updateMenuItem] update failed', error.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/menu')
  revalidatePath('/admin/menu')

  return { success: true }
}

// ---------------------------------------------------------------------------
// updateMorningMessage
// ---------------------------------------------------------------------------

/**
 * Set or clear the morning WhatsApp story message for a single menu item.
 * Requires admin session (LAERTE_PHONE).
 */
export async function updateMorningMessage(
  id: number,
  morningMessage: string | null,
): Promise<ActionResult> {
  if (!(await assertAdmin())) {
    return { success: false, error: 'Não autorizado.' }
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return { success: false, error: 'ID inválido.' }
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('menu_items')
    .update({
      morning_message: morningMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[updateMorningMessage] update failed', error.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  revalidatePath('/admin/notifications')

  return { success: true }
}
