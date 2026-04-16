'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  pixKey: string
}

/**
 * Tap-to-copy button for the Pix key.
 * Shows "Copiar chave Pix" and briefly changes to "Copiado!" after a successful copy.
 */
export function CopyPixButton({ pixKey }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pixKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the key text manually (no-op for now — clipboard permission denied)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleCopy}
      className="w-full min-h-[44px] font-semibold"
      variant={copied ? 'secondary' : 'default'}
    >
      {copied ? 'Copiado!' : 'Copiar chave Pix'}
    </Button>
  )
}
