/**
 * P1-017  Renders active Pix state (countdown + pix key + copy + cancel)
 * P1-018  Shows "Gerar novo Pix" after timer fires onExpire; renew resets timer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

vi.mock('@/actions/orders', () => ({
  cancelOrder: vi.fn(),
  renewPixExpiry: vi.fn(),
}))

import { PixSection } from '@/components/features/PixSection'
import { renewPixExpiry, cancelOrder } from '@/actions/orders'

const mockRenew = vi.mocked(renewPixExpiry)
const mockCancel = vi.mocked(cancelOrder)

function futureISO(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastISO(seconds: number) {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

beforeEach(() => {
  mockRenew.mockReset()
  mockCancel.mockReset()
})

describe('PixSection', () => {
  it('[P1-017] active state renders countdown, pix key, copy button, and cancel', () => {
    render(
      <PixSection
        orderId={1}
        pixKey="11999999999"
        initialExpiresAt={futureISO(600)}
        initiallyExpired={false}
      />,
    )

    expect(screen.getByText('11999999999')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar chave pix/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/tempo restante/i)).toBeInTheDocument()
  })

  it('[P1-017] shows price instruction in active state', () => {
    render(
      <PixSection
        orderId={1}
        pixKey="pix@key"
        initialExpiresAt={futureISO(600)}
        initiallyExpired={false}
      />,
    )
    expect(screen.getByText(/R\$\s*35,00/)).toBeInTheDocument()
  })

  it('initiallyExpired=true renders expired view immediately', () => {
    render(
      <PixSection
        orderId={1}
        pixKey="pix@key"
        initialExpiresAt={pastISO(60)}
        initiallyExpired={true}
      />,
    )
    expect(screen.getByText('Seu tempo para pagar expirou.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerar novo pix/i })).toBeInTheDocument()
  })

  it('[P1-018] timer expiry transitions to expired view without reload', () => {
    vi.useFakeTimers()
    try {
      render(
        <PixSection
          orderId={1}
          pixKey="pix@key"
          initialExpiresAt={futureISO(2)}
          initiallyExpired={false}
        />,
      )

      act(() => { vi.advanceTimersByTime(3000) })

      expect(screen.getByText('Seu tempo para pagar expirou.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gerar novo pix/i })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('[P1-018] "Gerar novo Pix" calls renewPixExpiry and resets to active view', async () => {
    const newExpiry = futureISO(1800)
    mockRenew.mockResolvedValue({ success: true, data: { newExpiresAt: newExpiry } })

    const user = userEvent.setup()

    render(
      <PixSection
        orderId={7}
        pixKey="pix@key"
        initialExpiresAt={pastISO(10)}
        initiallyExpired={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /gerar novo pix/i }))

    expect(mockRenew).toHaveBeenCalledWith(7)
    expect(await screen.findByText('pix@key')).toBeInTheDocument()
  })

  it('renewPixExpiry error is shown inline', async () => {
    mockRenew.mockResolvedValue({ success: false, error: 'Pedido não encontrado.' })

    const user = userEvent.setup()

    render(
      <PixSection
        orderId={1}
        pixKey="pix@key"
        initialExpiresAt={pastISO(10)}
        initiallyExpired={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: /gerar novo pix/i }))

    expect(await screen.findByText('Pedido não encontrado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gerar novo pix/i })).toBeInTheDocument()
  })
})
