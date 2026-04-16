/**
 * Z-API integration — send WhatsApp messages via REST API.
 * Documentation: https://developer.z-api.io/
 */

/**
 * Send a WhatsApp text message to a phone number.
 * @param phone - Recipient phone in E.164 format (e.g. +5511999999999)
 * @param text  - Message body (plain text)
 * @throws Error if Z-API returns a non-2xx response
 */
export async function sendMessage(phone: string, text: string): Promise<void> {
  // In test environments, skip real HTTP calls and log instead.
  if (process.env.ZAPI_MOCK === 'true') {
    console.log('[zapi-mock] sendMessage', { phone, text })
    return
  }

  const baseUrl = process.env.ZAPI_BASE_URL
  const token = process.env.ZAPI_TOKEN

  if (!baseUrl || !token) {
    throw new Error('Z-API environment variables are not configured')
  }

  const url = `${baseUrl}/send-text`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': token,
    },
    body: JSON.stringify({ phone, message: text }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)')
    console.error('[zapi] sendMessage failed', {
      status: response.status,
      phone,
      body,
    })
    throw new Error(`Z-API error: ${response.status}`)
  }
}
