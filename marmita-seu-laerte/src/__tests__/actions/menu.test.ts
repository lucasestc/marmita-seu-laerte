// @vitest-environment node
/**
 * P1 tests for menu server actions:
 *   P1-007  createMenuWeek happy path → week + items inserted, returns weekId
 *   P1-007  createMenuWeek duplicate week → Portuguese error
 *   P1-008  updateMenuItem → persists name + description change
 *   P1-016  updateMorningMessage → persists to menu_items.morning_message
 *
 * Non-admin access to all three actions → 'Não autorizado.'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeSequentialMockSupabase } from '../helpers/supabase-mock'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------

import { createMenuWeek, updateMenuItem, updateMorningMessage } from '@/actions/menu'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const adminSession = { customerId: 99, phone: '+5511000000000' }
const regularSession = { customerId: 1, phone: '+5511999999999' }

const validMenuInput = {
  week_start: '2026-04-20',
  items: [
    { delivery_date: '2026-04-21', name: 'Frango Grelhado', description: 'Com arroz e feijão' },
    { delivery_date: '2026-04-22', name: 'Feijoada', description: 'Tradicional' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.LAERTE_PHONE = adminSession.phone
  vi.mocked(getSession).mockResolvedValue(adminSession)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LAERTE_PHONE
})

// ---------------------------------------------------------------------------
// createMenuWeek
// ---------------------------------------------------------------------------

describe('createMenuWeek', () => {
  it('[P1-007] happy path → inserts week + items, returns weekId, revalidates paths', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 5 }, error: null },   // menu_weeks insert.select.single()
      { data: null, error: null },          // menu_items insert (direct await)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await createMenuWeek(validMenuInput)

    expect(result).toEqual({ success: true, data: { weekId: 5 } })
    expect(supabase.insert).toHaveBeenCalledTimes(2)
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/menu')
  })

  it('[P1-007] duplicate week (unique constraint 23505) → Portuguese error', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: null, error: { code: '23505', message: 'unique violation' } },
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await createMenuWeek(validMenuInput)

    expect(result).toEqual({
      success: false,
      error: 'Já existe um cardápio para esta semana.',
    })
    // Items insert should not have been attempted
    expect(supabase.insert).toHaveBeenCalledTimes(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('non-admin → Não autorizado without hitting DB', async () => {
    vi.mocked(getSession).mockResolvedValue(regularSession)

    const result = await createMenuWeek(validMenuInput)

    expect(result).toEqual({ success: false, error: 'Não autorizado.' })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('unauthenticated → Não autorizado', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const result = await createMenuWeek(validMenuInput)

    expect(result).toEqual({ success: false, error: 'Não autorizado.' })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('empty items array → Zod error, no DB call', async () => {
    const result = await createMenuWeek({ week_start: '2026-04-20', items: [] })

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('invalid week_start format → Zod error', async () => {
    const result = await createMenuWeek({
      week_start: 'not-a-date',
      items: validMenuInput.items,
    })

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('items insert fails → orphaned week cleanup attempted, returns error', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: { id: 5 }, error: null },             // week insert succeeds
      { data: null, error: { message: 'items DB error' } }, // items insert fails
      { data: null, error: null },                   // delete cleanup (direct await)
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await createMenuWeek(validMenuInput)

    expect(result.success).toBe(false)
    // Cleanup delete should have been called
    expect(supabase.delete).toHaveBeenCalledOnce()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// updateMenuItem
// ---------------------------------------------------------------------------

describe('updateMenuItem', () => {
  it('[P1-008] happy path → update called with correct payload', async () => {
    const supabase = makeSequentialMockSupabase(
      { data: null, error: null }, // update().eq() direct await
    )
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await updateMenuItem(42, 'Novo Nome', 'Nova descrição')

    expect(result).toEqual({ success: true })
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Novo Nome', description: 'Nova descrição' }),
    )
    expect(supabase.eq).toHaveBeenCalledWith('id', 42)
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('[P1-008] description omitted → stored as null', async () => {
    const supabase = makeSequentialMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    await updateMenuItem(42, 'Frango')

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Frango', description: null }),
    )
  })

  it('non-admin → Não autorizado, no DB call', async () => {
    vi.mocked(getSession).mockResolvedValue(regularSession)

    const result = await updateMenuItem(42, 'Nome')

    expect(result).toEqual({ success: false, error: 'Não autorizado.' })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('empty name → Zod error, no DB call', async () => {
    const result = await updateMenuItem(42, '')

    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// updateMorningMessage
// ---------------------------------------------------------------------------

describe('updateMorningMessage', () => {
  it('[P1-016] sets morning_message on the item', async () => {
    const supabase = makeSequentialMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await updateMorningMessage(7, 'Hoje tem frango caprichado 🍗')

    expect(result).toEqual({ success: true })
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ morning_message: 'Hoje tem frango caprichado 🍗' }),
    )
    expect(supabase.eq).toHaveBeenCalledWith('id', 7)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/notifications')
  })

  it('[P1-016] null clears the morning message', async () => {
    const supabase = makeSequentialMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>)

    const result = await updateMorningMessage(7, null)

    expect(result).toEqual({ success: true })
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ morning_message: null }),
    )
  })

  it('non-admin → Não autorizado', async () => {
    vi.mocked(getSession).mockResolvedValue(regularSession)

    const result = await updateMorningMessage(7, 'test')

    expect(result).toEqual({ success: false, error: 'Não autorizado.' })
  })
})
