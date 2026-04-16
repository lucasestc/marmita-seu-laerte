'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { sendMessage } from '@/lib/zapi'
import type { ActionResult } from '@/types/app.types'

// ---------------------------------------------------------------------------
// submitRating
// ---------------------------------------------------------------------------

const submitRatingSchema = z.object({
  orderId: z.number().int().positive(),
  stars: z.number().int().min(1).max(5),
})

/**
 * Insert a star rating for a completed order.
 *
 * - Validates the order belongs to the authenticated customer.
 * - The UNIQUE constraint on ratings.order_id prevents duplicates; the
 *   duplicate case is caught and returned as a user-facing error.
 */
export async function submitRating(
  orderId: number,
  stars: number,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Você precisa estar autenticado.' }
  }

  const parsed = submitRatingSchema.safeParse({ orderId, stars })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = createServiceClient()

  // Resolve customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', session.phone)
    .single()

  if (customerError || !customer) {
    return { success: false, error: 'Sessão inválida. Faça login novamente.' }
  }

  // Verify order ownership
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', parsed.data.orderId)
    .eq('customer_id', customer.id as number)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Pedido não encontrado.' }
  }

  // Insert rating — unique constraint on order_id prevents duplicates
  const { error: insertError } = await supabase.from('ratings').insert({
    order_id: order.id as number,
    customer_id: customer.id as number,
    stars: parsed.data.stars,
  })

  if (insertError) {
    // Postgres unique violation code
    if (insertError.code === '23505') {
      return { success: false, error: 'Você já avaliou este pedido.' }
    }
    console.error('[submitRating] insert failed', insertError.message)
    return { success: false, error: 'Erro interno. Tente novamente.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// requestDeletion
// ---------------------------------------------------------------------------

/**
 * Submit a LGPD data deletion request.
 *
 * - Sends an email to LAERTE_EMAIL with the customer's phone and timestamp.
 * - Sends a WhatsApp confirmation to the customer (non-blocking).
 * - Returns { success: true } even if the email fails — the request is
 *   always logged server-side so it can be actioned manually.
 */
export async function requestDeletion(): Promise<ActionResult> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Você precisa estar autenticado.' }
  }

  const requestedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

  console.log('[requestDeletion] Deletion request received', {
    phone: session.phone,
    requestedAt,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const laerteEmail = process.env.LAERTE_EMAIL
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@marmitadoseulaerte.com.br'

  try {
    await resend.emails.send({
      from: fromEmail,
      to: laerteEmail!,
      subject: 'Solicitação de exclusão de dados',
      text: [
        'Uma solicitação de exclusão de dados foi recebida.',
        '',
        `Telefone: ${session.phone}`,
        `Data/hora: ${requestedAt}`,
        '',
        'Excluir os dados do cliente em até 15 dias úteis conforme a LGPD.',
      ].join('\n'),
    })
  } catch (err: unknown) {
    console.error('[requestDeletion] Email failed — request logged above for manual follow-up', {
      phone: session.phone,
      error: err instanceof Error ? err.message : String(err),
    })
    // Intentionally fall through — customer still sees confirmation
  }

  // WhatsApp confirmation to customer (non-blocking)
  sendMessage(
    session.phone,
    'Recebemos sua solicitação de exclusão de dados. Em até 15 dias úteis, seus dados serão removidos.',
  ).catch((err: unknown) => {
    console.error('[requestDeletion] WhatsApp confirmation failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return { success: true }
}
