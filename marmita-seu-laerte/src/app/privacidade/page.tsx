import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Marmita do Seu Laerte',
  description:
    'Saiba como a Marmita do Seu Laerte coleta, usa e protege seus dados pessoais.',
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-8"
      >
        ← Voltar ao início
      </Link>

      <h1 className="text-2xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Última atualização: abril de 2026
      </p>

      <div className="prose prose-sm max-w-none flex flex-col gap-6 text-foreground">
        <section>
          <h2 className="text-lg font-semibold mb-2">
            1. Quem somos
          </h2>
          <p>
            A <strong>Marmita do Seu Laerte</strong> é um serviço de entrega de
            marmitas caseiras operado por Laerte Oliveira, com sede em São Paulo
            (SP). Esta política descreve como coletamos, usamos e protegemos
            seus dados pessoais em conformidade com a Lei Geral de Proteção de
            Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            2. Dados que coletamos
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>Número de WhatsApp:</strong> usado como identificador
              único de conta e canal de comunicação.
            </li>
            <li>
              <strong>Nome:</strong> fornecido voluntariamente e usado para
              personalizar comunicações.
            </li>
            <li>
              <strong>Histórico de pedidos:</strong> datas, pratos escolhidos e
              status de pagamento, necessários para operação do serviço.
            </li>
            <li>
              <strong>Consentimento de comunicação:</strong> registro de que
              você autorizou o recebimento de mensagens via WhatsApp.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            3. Como usamos seus dados
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Autenticação via código de acesso enviado por WhatsApp.</li>
            <li>
              Confirmação de pedidos e notificações de entrega pelo WhatsApp.
            </li>
            <li>
              Envio semanal do cardápio e convite para avaliar as refeições.
            </li>
            <li>
              Organização da produção diária (lista de pedidos para o Seu
              Laerte).
            </li>
          </ul>
          <p className="mt-2">
            Seus dados <strong>nunca são vendidos ou compartilhados</strong> com
            terceiros para fins comerciais.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            4. Base legal
          </h2>
          <p>
            O tratamento dos seus dados é baseado no seu{' '}
            <strong>consentimento expresso</strong> (art. 7º, I da LGPD),
            fornecido ao marcar a caixa de aceitação no cadastro, e na{' '}
            <strong>execução do contrato</strong> de fornecimento de marmitas
            (art. 7º, V da LGPD).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            5. Retenção e exclusão
          </h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Você pode
            solicitar a exclusão completa dos seus dados a qualquer momento.
            Após a solicitação, seus dados serão removidos em até 30 dias, salvo
            obrigações legais de retenção.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            6. Seus direitos
          </h2>
          <p>De acordo com a LGPD, você tem direito a:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Confirmar a existência de tratamento dos seus dados.</li>
            <li>Acessar seus dados.</li>
            <li>Corrigir dados incompletos ou desatualizados.</li>
            <li>
              Solicitar a anonimização, bloqueio ou exclusão dos seus dados.
            </li>
            <li>Revogar o consentimento a qualquer momento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            7. Como exercer seus direitos
          </h2>
          <p>
            Para solicitar exclusão de dados, cancelamento de comunicações ou
            qualquer dúvida sobre esta política, envie uma mensagem pelo
            WhatsApp ou entre em contato diretamente com o Seu Laerte. Seu
            pedido será processado em até 30 dias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            8. Segurança
          </h2>
          <p>
            Adotamos medidas técnicas adequadas para proteger seus dados,
            incluindo transmissão criptografada (HTTPS) e armazenamento seguro
            em infraestrutura gerenciada (Supabase / Vercel). Códigos de acesso
            nunca são armazenados em texto simples.
          </p>
        </section>
      </div>
    </main>
  )
}
