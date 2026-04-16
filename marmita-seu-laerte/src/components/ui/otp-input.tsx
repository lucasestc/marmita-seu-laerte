'use client'

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  hasError?: boolean
}

/**
 * 6-digit OTP input with per-box auto-advance, backspace navigation, and paste support.
 * Controlled: parent owns `value` (a string of up to 6 digit chars) via `onChange`.
 */
export function OtpInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  // Derive per-box display values from the controlled string
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  function focusBox(i: number) {
    const el = refs.current[i]
    if (el) {
      el.focus()
      // Select existing content so typing replaces it
      el.setSelectionRange(0, el.value.length)
    }
  }

  function commit(newDigits: string[]) {
    onChange(newDigits.join(''))
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')

    // Autocomplete or paste routed through onChange (e.g. iOS one-time-code)
    if (raw.length > 1) {
      const d = Array.from({ length: 6 }, (_, j) => raw[j] ?? '')
      commit(d)
      // Focus next empty box (consistent with handlePaste)
      focusBox(Math.min(raw.length, 5))
      return
    }

    const d = [...digits]
    d[i] = raw
    commit(d)
    if (raw && i < 5) focusBox(i + 1)
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        // Clear current box
        const d = [...digits]
        d[i] = ''
        commit(d)
      } else if (i > 0) {
        // Current already empty — clear previous and move focus there
        e.preventDefault()
        const d = [...digits]
        d[i - 1] = ''
        commit(d)
        focusBox(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const d = Array.from({ length: 6 }, (_, i) => pasted[i] ?? '')
    commit(d)
    focusBox(Math.min(pasted.length, 5))
  }

  return (
    <div
      className="flex gap-2 justify-center"
      role="group"
      aria-label="Código de verificação"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de 6`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={cn(
            'w-11 h-14 text-center text-xl font-semibold rounded-lg border-2 bg-card',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            hasError
              ? 'border-destructive focus-visible:ring-destructive'
              : 'border-input focus-visible:ring-ring focus-visible:border-primary',
          )}
        />
      ))}
    </div>
  )
}
