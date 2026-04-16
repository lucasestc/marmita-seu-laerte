'use client'

import React, { useState, useEffect } from 'react'

function getRemainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

type Props = {
  expiresAt: string
  /** Called once when the countdown reaches 00:00. */
  onExpire?: () => void
}

/**
 * Live countdown to expiresAt (ISO timestamp).
 * Shows MM:SS. When it reaches 00:00 it stops, stays at 00:00, and fires onExpire.
 */
export function CountdownTimer({ expiresAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(expiresAt))
  const onExpireRef = React.useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    // Re-sync immediately in case of hydration skew
    setRemaining(getRemainingSeconds(expiresAt))

    const interval = setInterval(() => {
      const r = getRemainingSeconds(expiresAt)
      setRemaining(r)
      if (r === 0) {
        clearInterval(interval)
        onExpireRef.current?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const isExpired = remaining === 0

  return (
    <span
      className={
        isExpired
          ? 'tabular-nums font-mono text-2xl font-bold text-destructive'
          : 'tabular-nums font-mono text-2xl font-bold text-foreground'
      }
      aria-live="off"
      aria-label={`Tempo restante: ${formatTime(remaining)}`}
    >
      {formatTime(remaining)}
    </span>
  )
}
