import type { Metadata } from 'next'
import { LoginFlow } from '@/components/features/LoginFlow'

export const metadata: Metadata = {
  title: 'Entrar — Marmita do Seu Laerte',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ from?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { from } = await searchParams
  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12">
      <LoginFlow from={from} />
    </main>
  )
}
