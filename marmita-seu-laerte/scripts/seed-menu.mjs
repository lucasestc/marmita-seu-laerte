// Seeds a menu week for the current week into the test Supabase
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (load from .env.local or .env.test)
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get Monday of the current week (Brasília)
function getMondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const weekStart = getMondayOfCurrentWeek()
console.log(`Seeding menu week starting ${weekStart}...`)

// Insert menu week
const { data: week, error: weekErr } = await supabase
  .from('menu_weeks')
  .upsert({ week_start: weekStart }, { onConflict: 'week_start' })
  .select()
  .single()

if (weekErr) { console.error('week insert failed:', weekErr); process.exit(1) }
console.log(`Menu week id: ${week.id}`)

// Delete existing items for this week (clean slate)
await supabase.from('menu_items').delete().eq('menu_week_id', week.id)

// Insert Mon–Fri items
const items = [
  { name: 'Frango Assado com Farofa',      description: 'Frango temperado na hora, assado lentamente, com farofa crocante de bacon e arroz branco.' },
  { name: 'Carne Moída com Batata',         description: 'Carne moída refogada com tomate e pimentão, acompanhada de batata palito e feijão.' },
  { name: 'Filé de Peixe Grelhado',         description: 'Filé de tilápia grelhado com limão siciliano, servido com purê de mandioquinha.' },
  { name: 'Costela de Porco com Mandioca',  description: 'Costela de porco desfiada cozida por horas, com mandioca cozida e vinagrete.' },
  { name: 'Feijoada Especial',              description: 'Feijoada completa com lombo, linguiça e costelinha, arroz, couve refogada e laranja.' },
]

const rows = items.map((item, i) => ({
  menu_week_id: week.id,
  delivery_date: addDays(weekStart, i),
  name: item.name,
  description: item.description,
  morning_message: `Hoje tem ${item.name}! ${item.description}`,
}))

const { error: itemsErr } = await supabase.from('menu_items').insert(rows)
if (itemsErr) { console.error('items insert failed:', itemsErr); process.exit(1) }

console.log('Done! Menu seeded:')
items.forEach((item, i) => console.log(`  ${addDays(weekStart, i)} — ${item.name}`))
