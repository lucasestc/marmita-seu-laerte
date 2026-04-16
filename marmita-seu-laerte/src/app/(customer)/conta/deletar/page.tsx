import type { Metadata } from 'next'
import { DeletionRequestButton } from '@/components/features/DeletionRequestButton'

export const metadata: Metadata = {
  title: 'Excluir meus dados — Marmita do Seu Laerte',
  robots: { index: false, follow: false },
}

export default function DeletarContaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 py-5">
          <p className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wide">
            Conta
          </p>
          <h1 className="text-lg font-bold">Exclusão de dados</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-foreground">O que será excluído</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Seu nome e número de telefone</li>
              <li>Histórico de pedidos e avaliações</li>
              <li>Preferências de notificação</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Após a solicitação, seus dados serão removidos em até{' '}
            <strong className="text-foreground">15 dias úteis</strong>.
            Você receberá uma confirmação via WhatsApp.
          </p>

          <DeletionRequestButton />
        </div>
      </main>
    </div>
  )
}
