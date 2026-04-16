/**
 * Shared phone number helpers.
 */

/**
 * Normalise a phone string for comparison.
 * Strips @c.us suffix, whitespace, and leading + so that
 * "+5511999999999" and "5511999999999@c.us" compare as equal,
 * regardless of how Z-API delivers the phone in webhook payloads.
 */
export function normalisePhone(raw: string): string {
  return raw.replace(/@c\.us$/i, '').replace(/\s+/g, '').replace(/^\+/, '')
}
