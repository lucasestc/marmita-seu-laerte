import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CountdownTimer } from '@/components/features/CountdownTimer'

function futureISO(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function pastISO(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows MM:SS for a future expiry', () => {
    render(<CountdownTimer expiresAt={futureISO(125)} />)
    // 2 minutes 5 seconds
    expect(screen.getByText('02:05')).toBeInTheDocument()
  })

  it('shows 00:00 for an already-expired timestamp', () => {
    render(<CountdownTimer expiresAt={pastISO(60)} />)
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('counts down over time', () => {
    render(<CountdownTimer expiresAt={futureISO(10)} />)
    expect(screen.getByText('00:10')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('00:07')).toBeInTheDocument()
  })

  it('fires onExpire once when the countdown reaches zero', () => {
    const onExpire = vi.fn()
    render(<CountdownTimer expiresAt={futureISO(2)} onExpire={onExpire} />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(onExpire).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('does not fire onExpire again after already at zero', () => {
    const onExpire = vi.fn()
    render(<CountdownTimer expiresAt={futureISO(1)} onExpire={onExpire} />)

    act(() => { vi.advanceTimersByTime(5000) })
    // Should only fire once even though 5 ticks passed the zero mark
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('shows 00:00 and stops at zero', () => {
    render(<CountdownTimer expiresAt={futureISO(2)} />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('has an accessible aria-label with the remaining time', () => {
    render(<CountdownTimer expiresAt={futureISO(90)} />)
    expect(screen.getByLabelText('Tempo restante: 01:30')).toBeInTheDocument()
  })
})
