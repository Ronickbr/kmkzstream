import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — KMKZ Streaming" },
      {
        name: "description",
        content:
          "Política de Privacidade da KMKZ Streaming em conformidade com a LGPD: dados coletados, finalidades, base legal, compartilhamento, direitos do titular e segurança.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-dvh bg-[color:var(--color-vinyl)] text-white font-body-b">
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">
          Documento legal · v1.0 · LGPD
        </p>
        <h1 className="mt-3 font-broadcast text-4xl leading-tight text-white">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-invert mt-10 max-w-none space-y-8 text-[15px] leading-relaxed text-white/80">
          <section>
            <h2 className="font-broadcast text-xl text-white">1. Quem somos</h2>
            <p>
              A KMKZ Streaming (“KMKZ”, “nós”) é a controladora dos dados
              pessoais tratados na Plataforma, nos termos da Lei Geral de
              Proteção de Dados Pessoais (Lei nº 13.709/2018 — “LGPD”).
              Encarregado (DPO) pode ser contatado em{" "}
              <a href="mailto:privacidade@kmkzstream.lovable.app" className="text-[color:var(--color-tally)] underline">
                privacidade@kmkzstream.lovable.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">2. Dados que coletamos</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Cadastrais:</strong> nome, e-mail, WhatsApp, CPF (quando exigido para pagamento/anti-fraude), senha (armazenada com hash).</li>
              <li><strong>Transacionais:</strong> plano contratado, histórico de pagamentos, forma de pagamento (não armazenamos dados completos de cartão — processados pelo gateway).</li>
              <li><strong>Uso:</strong> logs de acesso, endereço IP, dispositivo, navegador, páginas visitadas, cliques e interações com o programa de pontos.</li>
              <li><strong>Indicações:</strong> vínculo entre indicador e indicado, pontuação, conquistas e resgates.</li>
              <li><strong>Endereço postal:</strong> apenas quando você resgata prêmios físicos.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">3. Finalidades e base legal</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Execução do contrato:</strong> criar e manter sua conta, viabilizar acesso, processar pagamentos e prêmios.</li>
              <li><strong>Cumprimento de obrigação legal:</strong> emissão fiscal, prevenção à fraude, atendimento a autoridades.</li>
              <li><strong>Legítimo interesse:</strong> segurança da Plataforma, prevenção a abusos no programa de indicações, melhorias de produto e comunicações operacionais.</li>
              <li><strong>Consentimento:</strong> envio de comunicações de marketing, notificações opcionais e cookies não essenciais.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">4. Compartilhamento</h2>
            <p>Compartilhamos dados estritamente necessários com:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Processadores de pagamento (Pix, cartão) para viabilizar a cobrança.</li>
              <li>Provedores de infraestrutura em nuvem, autenticação e envio de e-mails/SMS.</li>
              <li>Transportadoras, para entrega de prêmios físicos.</li>
              <li>Autoridades públicas, quando exigido por lei ou ordem judicial.</li>
            </ul>
            <p>Não vendemos dados pessoais a terceiros.</p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">5. Cookies</h2>
            <p>
              Utilizamos cookies essenciais (sessão, autenticação, segurança) e
              cookies analíticos para entender o uso da Plataforma. Você pode
              configurar seu navegador para bloqueá-los, ciente de que
              funcionalidades podem ser impactadas.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">6. Retenção</h2>
            <p>
              Os dados são mantidos enquanto sua conta estiver ativa e pelo
              prazo necessário ao cumprimento de obrigações legais, fiscais e
              regulatórias (em regra, até 5 anos após o encerramento da
              relação), ou por prazo maior quando exigido por lei ou para o
              exercício regular de direitos em processo judicial,
              administrativo ou arbitral.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">7. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus
              dados: criptografia em trânsito (HTTPS/TLS), hash de senhas,
              controle de acesso por papéis, Row Level Security no banco de
              dados, monitoramento e logs. Nenhum sistema é 100% imune —
              incidentes relevantes serão comunicados à ANPD e aos titulares
              afetados nos termos da LGPD.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">8. Direitos do titular</h2>
            <p>Você pode a qualquer momento solicitar:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Confirmação da existência de tratamento e acesso aos dados.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
              <li>Portabilidade a outro fornecedor.</li>
              <li>Eliminação de dados tratados com base em consentimento.</li>
              <li>Informação sobre compartilhamentos e revogação do consentimento.</li>
            </ul>
            <p>
              Solicitações podem ser enviadas para{" "}
              <a href="mailto:privacidade@kmkzstream.lovable.app" className="text-[color:var(--color-tally)] underline">
                privacidade@kmkzstream.lovable.app
              </a>
              . Poderemos solicitar informações adicionais para confirmar sua
              identidade.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">9. Menores</h2>
            <p>
              A Plataforma não se destina a menores de 18 anos sem
              consentimento e supervisão de responsáveis legais. Ao identificar
              cadastro irregular, a conta será suspensa e os dados eliminados.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">10. Transferência internacional</h2>
            <p>
              Alguns provedores de infraestrutura podem estar localizados fora
              do Brasil. Nesses casos, garantimos que os fornecedores adotem
              padrões compatíveis com a LGPD.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">11. Alterações</h2>
            <p>
              Esta Política pode ser atualizada. Comunicaremos alterações
              relevantes por e-mail e/ou banner na Plataforma. A data no topo
              indica a versão vigente.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <Link
            to="/"
            className="font-mono-b text-[11px] uppercase tracking-[0.22em] text-white/60 hover:text-white"
          >
            ← Voltar ao início
          </Link>
        </div>
      </main>
    </div>
  );
}
