/**
 * P2-001  Two-step confirm flow; success message shown after confirm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/actions/ratings', () => ({
  submitRating: vi.fn(),
  requestDeletion: vi.fn(),
}))

import { DeletionRequestButton } from '@/components/features/DeletionRequestButton'
import { requestDeletion } from '@/actions/ratings'

const mockRequest = vi.mocked(requestDeletion)

beforeEach(() => {
  mockRequest.mockReset()
})

describe('DeletionRequestButton', () => {
  it('[P2-001] renders initial delete button', () => {
    render(<DeletionRequestButton />)
    expect(screen.getByRole('button', { name: /solicitar exclusão/i })).toBeInTheDocument()
  })

  it('[P2-001] first tap shows confirm row with warning text', async () => {
    const user = userEvent.setup()
    render(<DeletionRequestButton />)

    await user.click(screen.getByRole('button', { name: /solicitar exclusão/i }))

    expect(screen.getByText('Tem certeza? Esta ação não pode ser desfeita.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument()
  })

  it('[P2-001] "Cancelar" aborts and returns to initial state', async () => {
    const user = userEvent.setup()
    render(<DeletionRequestButton />)

    await user.click(screen.getByRole('button', { name: /solicitar exclusão/i }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: /solicitar exclusão/i })).toBeInTheDocument()
    expect(screen.queryByText('Tem certeza?')).not.toBeInTheDocument()
  })

  it('[P2-001] confirming calls requestDeletion', async () => {
    const user = userEvent.setup()
    mockRequest.mockResolvedValue({ success: true })

    render(<DeletionRequestButton />)

    await user.click(screen.getByRole('button', { name: /solicitar exclusão/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(mockRequest).toHaveBeenCalledOnce()
  })

  it('[P2-001] success shows the confirmation message', async () => {
    const user = userEvent.setup()
    mockRequest.mockResolvedValue({ success: true })

    render(<DeletionRequestButton />)

    await user.click(screen.getByRole('button', { name: /solicitar exclusão/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(
      await screen.findByText(/seus dados serão excluídos em até 15 dias úteis/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('action error: returns to initial button (error not re-shown in initial state)', async () => {
    const user = userEvent.setup()
    mockRequest.mockResolvedValue({ success: false, error: 'Erro interno.' })

    render(<DeletionRequestButton />)

    await user.click(screen.getByRole('button', { name: /solicitar exclusão/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    // setConfirming(false) and setError() are batched — initial button shown, error not rendered
    expect(await screen.findByRole('button', { name: /solicitar exclusão/i })).toBeInTheDocument()
    expect(screen.queryByText('Erro interno.')).not.toBeInTheDocument()
  })
})
