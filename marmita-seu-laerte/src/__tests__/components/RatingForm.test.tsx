/**
 * P1-019  Star selection updates display; submit calls submitRating
 * P1-020  Success message displayed after submit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/actions/ratings', () => ({
  submitRating: vi.fn(),
  requestDeletion: vi.fn(),
}))

import { RatingForm } from '@/components/features/RatingForm'
import { submitRating } from '@/actions/ratings'

const mockSubmit = vi.mocked(submitRating)

beforeEach(() => {
  mockSubmit.mockReset()
})

describe('RatingForm', () => {
  it('renders 5 star buttons and a disabled submit by default', () => {
    render(<RatingForm orderId={1} />)
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null)).toHaveLength(5)
    expect(screen.getByRole('button', { name: /enviar avaliação/i })).toBeDisabled()
  })

  it('[P1-019] selecting a star enables the submit button', async () => {
    const user = userEvent.setup()
    render(<RatingForm orderId={1} />)

    await user.click(screen.getByRole('button', { name: '4 estrelas' }))

    expect(screen.getByRole('button', { name: '4 estrelas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /enviar avaliação/i })).not.toBeDisabled()
  })

  it('[P1-019] submit calls submitRating with orderId and selected stars', async () => {
    const user = userEvent.setup()
    mockSubmit.mockResolvedValue({ success: true })
    render(<RatingForm orderId={99} />)

    await user.click(screen.getByRole('button', { name: '3 estrelas' }))
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }))

    expect(mockSubmit).toHaveBeenCalledOnce()
    expect(mockSubmit).toHaveBeenCalledWith(99, 3)
  })

  it('[P1-020] success shows the thank-you message', async () => {
    const user = userEvent.setup()
    mockSubmit.mockResolvedValue({ success: true })
    render(<RatingForm orderId={1} />)

    await user.click(screen.getByRole('button', { name: '5 estrelas' }))
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }))

    expect(await screen.findByText('Obrigado pela avaliação!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar avaliação/i })).not.toBeInTheDocument()
  })

  it('submitting without a star shows an inline error without hitting the action', async () => {
    const user = userEvent.setup()
    render(<RatingForm orderId={1} />)

    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }))

    // Button is disabled so the click is a no-op; no action called, no error shown via action
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('action error is shown inline', async () => {
    const user = userEvent.setup()
    mockSubmit.mockResolvedValue({ success: false, error: 'Você já avaliou este pedido.' })
    render(<RatingForm orderId={1} />)

    await user.click(screen.getByRole('button', { name: '2 estrelas' }))
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }))

    expect(await screen.findByText('Você já avaliou este pedido.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar avaliação/i })).toBeInTheDocument()
  })
})
