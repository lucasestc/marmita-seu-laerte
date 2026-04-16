import Link from 'next/link'
import { NewMenuWeekForm } from '@/components/features/NewMenuWeekForm'

export default function NovaSemanPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-5">
          <Link
            href="/admin/menu"
            className="text-primary-foreground/80 hover:text-primary-foreground text-sm underline underline-offset-2"
          >
            ← Cardápios
          </Link>
          <h1 className="text-lg font-bold">Nova semana</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <NewMenuWeekForm />
      </main>
    </div>
  )
}
