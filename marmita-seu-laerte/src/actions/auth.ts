'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/session'
import { sendMessage } from '@/lib/zapi'
import type { ActionResult } from '@/types/app.types'

/** Normalize a Brazilian phone number to E.164 format (+5511999999999). */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `+${withCountry}`
}

const requestOtpSchema = z.object({
  phone: z
    .string()
    .min(1, 'Informe seu número de WhatsApp.')
    .transform(normalizePhone)
    .refine(
      (val) => /^\+55\d{10,11}$/.test(val),
      'Número de WhatsApp inválido. Use o formato (11) 99999-9999.',
    ),
  consent: z.literal(true, {
    message:
      'Você precisa aceitar receber mensagens no WhatsApp para continuar.',
  }),
})

/**
 * Request a WhatsApp OTP for the given phone number.
 * Creates an otp_codes row and sends the code via Z-API.
 * Returns the normalized E.164 phone on success.
 */
export async function requestOtp(
  phone: string,
  consent: boolean,
): Promise<ActionResult<{ phone: string }>> {
  const parsed = requestOtpSchema.safeParse({ phone, consent })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { success: false, error: message }
  }

  const normalizedPhone = parsed.data.phone

  // Generate 6-digit code — never stored in plain text
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  const supabase = createServiceClient()

  const { error: dbError } = await supabase.from('otp_codes').insert({
    phone: normalizedPhone,
    code_hash: codeHash,
    expires_at: expiresAt.toISOString(),
  })

  if (dbError) {
    console.error('[requestOtp] DB insert failed', {
      phone: normalizedPhone,
      error: dbError.message,
    })
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  try {
    await sendMessage(
      normalizedPhone,
      `Seu código de acesso: ${code}. Válido por 10 minutos.`,
    )
  } catch (err) {
    console.error('[requestOtp] Z-API sendMessage failed', {
      phone: normalizedPhone,
      error: err,
    })
    return {
      success: false,
      error: 'Não foi possível enviar o código. Tente novamente.',
    }
  }

  return { success: true, data: { phone: normalizedPhone } }
}

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

const verifyOtpSchema = z.object({
  phone: z
    .string()
    .refine(
      (val) => /^\+55\d{10,11}$/.test(val),
      'Número de telefone inválido.',
    ),
  code: z
    .string()
    .regex(/^\d{6}$/, 'O código deve ter 6 dígitos numéricos.'),
})

/**
 * Verify a WhatsApp OTP code for the given phone number.
 * On success: marks the OTP used, upserts the customer, creates a 30-day session,
 * and redirects to `from` (default: '/').
 * On failure: returns ActionResult with a Portuguese error message.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  from: string = '/',
): Promise<ActionResult> {
  const parsed = verifyOtpSchema.safeParse({ phone, code })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { success: false, error: message }
  }

  const { phone: normalizedPhone, code: cleanCode } = parsed.data
  const supabase = createServiceClient()

  // Find the most recent unused OTP row for this phone
  const { data: otpRow, error: queryError } = await supabase
    .from('otp_codes')
    .select('id, code_hash, expires_at')
    .eq('phone', normalizedPhone)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (queryError) {
    console.error('[verifyOtp] DB query failed', { phone: normalizedPhone, error: queryError.message })
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  if (!otpRow) {
    return { success: false, error: 'Código inválido. Verifique e tente novamente.' }
  }

  if (new Date(otpRow.expires_at) < new Date()) {
    return { success: false, error: 'Código expirado. Solicite um novo código.' }
  }

  const isValid = await bcrypt.compare(cleanCode, otpRow.code_hash)
  if (!isValid) {
    return { success: false, error: 'Código inválido. Verifique e tente novamente.' }
  }

  // Mark OTP as used (best-effort — session is already valid after bcrypt passes)
  await supabase
    .from('otp_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', otpRow.id)

  // Upsert customer — creates on first login, updates nothing on subsequent logins
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .upsert(
      { phone: normalizedPhone, whatsapp_consent: true },
      { onConflict: 'phone' },
    )
    .select('id')
    .single()

  if (customerError || !customer) {
    console.error('[verifyOtp] customer upsert failed', {
      phone: normalizedPhone,
      error: customerError?.message,
    })
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  await createSession(customer.id, normalizedPhone)

  // Guard against open redirect
  const safeFrom =
    from.startsWith('/') && !from.startsWith('//') ? from : '/'
  redirect(safeFrom)
}
