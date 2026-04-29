/**
 * P1-015  First tap shows confirm row; second tap fires cancelOrder
 * P1-016  Success calls onCancelled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/actions/orders', () => ({
  cancelOrder: vi.fn(),
}))

import { CancelOrderButton } from '@/components/features/CancelOrderButton'
import { cancelOrder } from '@/actions/orders'

const mockCancelOrder = vi.mocked(cancelOrder)

beforeEach(() => {
  mockCancelOrder.mockReset()
})

describe('CancelOrderButton', () => {
  it('renders the initial cancel button', () => {
    render(<CancelOrderButton orderId={1} onCancelled={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
  })

  it('[P1-015] first tap shows the confirm row', async () => {
    const user = userEvent.setup()
    render(<CancelOrderButton orderId={1} onCancelled={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))

    expect(screen.getByText('Tem certeza que deseja cancelar?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Não' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sim, cancelar' })).toBeInTheDocument()
  })

  it('[P1-015] "Não" aborts and returns to initial state', async () => {
    const user = userEvent.setup()
    render(<CancelOrderButton orderId={1} onCancelled={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Não' }))

    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
    expect(screen.queryByText('Tem certeza que deseja cancelar?')).not.toBeInTheDocument()
  })

  it('[P1-015] second tap fires cancelOrder with the correct orderId', async () => {
    const user = userEvent.setup()
    mockCancelOrder.mockResolvedValue({ success: true })

    render(<CancelOrderButton orderId={42} onCancelled={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

    expect(mockCancelOrder).toHaveBeenCalledOnce()
    expect(mockCancelOrder).toHaveBeenCalledWith(42)
  })

  it('[P1-016] success calls onCancelled', async () => {
    const user = userEvent.setup()
    const onCancelled = vi.fn()
    mockCancelOrder.mockResolvedValue({ success: true })

    render(<CancelOrderButton orderId={1} onCancelled={onCancelled} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

    expect(onCancelled).toHaveBeenCalledOnce()
  })

  it('action error: returns to initial button (error not re-shown in initial state)', async () => {
    const user = userEvent.setup()
    mockCancelOrder.mockResolvedValue({ success: false, error: 'Pedido já confirmado.' })

    render(<CancelOrderButton orderId={1} onCancelled={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

    // setConfirming(false) and setError() are batched — initial button shown, error not rendered
    expect(await screen.findByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
    expect(screen.queryByText('Pedido já confirmado.')).not.toBeInTheDocument()
  })
})
