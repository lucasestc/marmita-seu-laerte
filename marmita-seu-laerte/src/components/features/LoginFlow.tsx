'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { OtpInput } from '@/components/ui/otp-input'
import { requestOtp, verifyOtp } from '@/actions/auth'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const phoneFormSchema = z.object({
  phone: z.string().min(8, 'Informe seu número de WhatsApp.'),
  consent: z.boolean(),
})

type PhoneFormValues = z.infer<typeof phoneFormSchema>

// ---------------------------------------------------------------------------
// Phone entry step
// ---------------------------------------------------------------------------

type PhoneStepProps = {
  onSuccess: (phone: string) => void
}

function PhoneStep({ onSuccess }: PhoneStepProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { phone: '', consent: false },
  })

  const onSubmit = form.handleSubmit((data) => {
    if (!data.consent) {
      form.setError('consent', {
        message:
          'Você precisa aceitar receber mensagens no WhatsApp para continuar.',
      })
      return
    }
    startTransition(async () => {
      const result = await requestOtp(data.phone, data.consent)
      if (result.success) {
        onSuccess(result.data!.phone)
      } else {
        form.setError('root', { message: result.error })
      }
    })
  })

  const consentError = form.formState.errors.consent?.message
  const phoneError = form.formState.errors.phone?.message
  const rootError = form.formState.errors.root?.message

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {/* Phone field */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone" className="text-sm font-medium">
          Seu WhatsApp
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          placeholder="(11) 99999-9999"
          autoComplete="tel"
          aria-invalid={!!phoneError}
          className="h-11 text-base"
          {...form.register('phone')}
        />
        {phoneError && (
          <p className="text-sm text-destructive">{phoneError}</p>
        )}
      </div>

      {/* LGPD consent */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            name="consent"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                id="consent"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked as boolean)}
                aria-invalid={!!consentError}
                className="mt-0.5"
              />
            )}
          />
          <Label
            htmlFor="consent"
            className="text-sm leading-relaxed cursor-pointer"
          >
            Aceito receber mensagens no WhatsApp sobre meus pedidos e o
            cardápio semanal.{' '}
            <a
              href="/privacidade"
              className="underline underline-offset-2 hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de privacidade
            </a>
            .
          </Label>
        </div>
        {consentError && (
          <p className="text-sm text-destructive pl-7">{consentError}</p>
        )}
      </div>

      {/* Root / server error */}
      {rootError && (
        <p
          role="alert"
          className="text-sm text-destructive rounded-lg bg-destructive/8 px-3 py-2"
        >
          {rootError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 text-base font-semibold w-full"
      >
        {isPending ? 'Enviando…' : 'Receber código'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// OTP verification step
// ---------------------------------------------------------------------------

type OtpStepProps = {
  phone: string
  from: string
  onBack: () => void
}

function OtpStep({ phone, from, onBack }: OtpStepProps) {
  const [code, setCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)

  const [isPendingVerify, startTransitionVerify] = useTransition()
  const [isPendingResend, startTransitionResend] = useTransition()

  const isDisabled = isPendingVerify || isPendingResend

  function handleVerify() {
    if (code.length < 6) {
      setOtpError('Digite todos os 6 dígitos do código.')
      return
    }
    setOtpError(null)
    startTransitionVerify(async () => {
      const result = await verifyOtp(phone, code, from)
      // Only reached on non-redirect (i.e. failure)
      if (!result.success) {
        setOtpError(result.error)
        setCode('')
      }
    })
  }

  function handleResend() {
    setResendError(null)
    setResendSuccess(false)
    setOtpError(null)
    setCode('')
    startTransitionResend(async () => {
      const result = await requestOtp(phone, true)
      if (result.success) {
        setResendSuccess(true)
      } else {
        setResendError(result.error ?? 'Erro ao reenviar. Tente novamente.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Código enviado para</p>
        <p className="font-semibold">{phone}</p>
      </div>

      <div className="flex flex-col gap-3">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v)
            setOtpError(null)
          }}
          disabled={isDisabled}
          hasError={!!otpError}
        />
        {otpError && (
          <p role="alert" className="text-sm text-destructive text-center">
            {otpError}
          </p>
        )}
      </div>

      {resendSuccess && (
        <p role="status" className="text-sm text-primary font-medium text-center">
          Novo código enviado!
        </p>
      )}
      {resendError && (
        <p role="alert" className="text-sm text-destructive text-center">
          {resendError}
        </p>
      )}

      <Button
        type="button"
        onClick={handleVerify}
        disabled={isDisabled || code.length < 6}
        className="h-11 text-base font-semibold w-full"
      >
        {isPendingVerify ? 'Verificando…' : 'Entrar'}
      </Button>

      <div className="flex flex-col gap-2 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={isDisabled}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50 mx-auto"
        >
          {isPendingResend ? 'Reenviando…' : 'Reenviar código'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isDisabled}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 mx-auto"
        >
          ← Trocar número
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoginFlow — orchestrates phone-entry → otp-entry states
// ---------------------------------------------------------------------------

type Step = 'phone' | 'otp'

type LoginFlowProps = {
  from?: string
}

export function LoginFlow({ from = '/' }: LoginFlowProps) {
  const [step, setStep] = useState<Step>('phone')
  const [sentPhone, setSentPhone] = useState('')

  function handleOtpSent(phone: string) {
    setSentPhone(phone)
    setStep('otp')
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
          <span className="text-2xl" role="img" aria-label="marmita">
            🍱
          </span>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          Marmita do Seu Laerte
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 'phone'
            ? 'Entre com seu WhatsApp para fazer seu pedido.'
            : 'Verifique seu WhatsApp.'}
        </p>
      </div>

      {step === 'phone' ? (
        <PhoneStep onSuccess={handleOtpSent} />
      ) : (
        <OtpStep
          phone={sentPhone}
          from={from}
          onBack={() => setStep('phone')}
        />
      )}
    </div>
  )
}
