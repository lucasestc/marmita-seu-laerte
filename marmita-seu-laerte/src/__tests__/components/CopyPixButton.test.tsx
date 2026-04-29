/**
 * P2-002  Calls navigator.clipboard.writeText(pixKey); shows "Copiado!" briefly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyPixButton } from '@/components/features/CopyPixButton'

const writeText = vi.fn()

function setupClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  writeText.mockReset()
  setupClipboard()
})

describe('CopyPixButton', () => {
  it('[P2-002] renders "Copiar chave Pix" initially', () => {
    render(<CopyPixButton pixKey="minha@chave" />)
    expect(screen.getByRole('button', { name: 'Copiar chave Pix' })).toBeInTheDocument()
  })

  it('[P2-002] calls navigator.clipboard.writeText with the pixKey', async () => {
    writeText.mockResolvedValue(undefined)
    render(<CopyPixButton pixKey="minha@chave" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar chave Pix' }))
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith('minha@chave')
  })

  it('[P2-002] shows "Copiado!" after a successful copy', async () => {
    writeText.mockResolvedValue(undefined)
    render(<CopyPixButton pixKey="minha@chave" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar chave Pix' }))
    expect(await screen.findByRole('button', { name: 'Copiado!' })).toBeInTheDocument()
  })

  it('[P2-002] reverts to "Copiar chave Pix" after 2 seconds', async () => {
    vi.useFakeTimers()
    try {
      writeText.mockResolvedValue(undefined)
      render(<CopyPixButton pixKey="minha@chave" />)

      // fireEvent is synchronous — doesn't advance fake timers internally
      fireEvent.click(screen.getByRole('button', { name: 'Copiar chave Pix' }))

      // Flush the microtask queue: writeText mock resolves → setCopied(true) fires
      await act(async () => {})

      expect(screen.getByRole('button', { name: 'Copiado!' })).toBeInTheDocument()

      // Advance past the 2 s revert timeout
      act(() => { vi.advanceTimersByTime(2001) })

      expect(screen.getByRole('button', { name: 'Copiar chave Pix' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clipboard failure is silently swallowed (no crash, no "Copiado!")', async () => {
    writeText.mockRejectedValue(new Error('Permission denied'))
    render(<CopyPixButton pixKey="minha@chave" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar chave Pix' }))
    expect(screen.getByRole('button', { name: 'Copiar chave Pix' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiado!' })).not.toBeInTheDocument()
  })
})
