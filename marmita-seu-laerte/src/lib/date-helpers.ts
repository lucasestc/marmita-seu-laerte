/**
 * Shared date/time helpers used across server actions and API routes.
 * All functions are pure (no side effects) and timezone-aware.
 */

/**
 * Returns tomorrow's date in Brasília as an ISO date string "YYYY-MM-DD".
 * Safe across month and year rollovers.
 */
export function tomorrowBrasilia(): string {
  const todayBrasilia = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
  const [y, m, d] = todayBrasilia.split('-').map(Number)
  const tomorrow = new Date(y, m - 1, d + 1)
  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Returns today's date in Brasília as an ISO date string "YYYY-MM-DD".
 */
export function todayBrasilia(): string {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
}

/**
 * Returns the next Monday after (or equal to tomorrow of) the given ISO date.
 * - Called on Sunday  → returns tomorrow (the coming Monday, +1 day)
 * - Called on Monday  → returns next Monday (+7 days)
 * - Called on any other day → returns the Monday of that same week's next week
 *
 * Used by the Sunday menu-reveal cron to query next week's items.
 */
export function nextMondayFrom(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay() // 0=Sun, 1=Mon … 6=Sat
  // Days until next Monday: Sunday→1, Monday→7, Tuesday→6, Wednesday→5 …
  const daysToMonday = dow === 0 ? 1 : 8 - dow
  date.setDate(date.getDate() + daysToMonday)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Returns the Monday of the week containing the given ISO date.
 * Uses UTC arithmetic to stay consistent regardless of the host timezone.
 * Used to align a date picker to the start of the week.
 */
export function mondayOfWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const dow = date.getUTCDay() // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow // days to subtract to reach Monday
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().split('T')[0]
}

/**
 * "2026-04-10" → "Quinta-feira, 10/04"
 * Formats a delivery date for display in WhatsApp messages (pt-BR, Brasília tz).
 */
export function formatDeliveryDateShort(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const weekday = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  })
  const dayMonth = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`
}
