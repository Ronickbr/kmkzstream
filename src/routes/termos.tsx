import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos e Condições de Uso — KMKZ Streaming" },
      {
        name: "description",
        content:
          "Termos e Condições de Uso da plataforma KMKZ Streaming: assinaturas, programa de indicações, pontos, prêmios e responsabilidades do usuário.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-dvh bg-[color:var(--color-vinyl)] text-white font-body-b">
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">
          Documento legal · v1.0
        </p>
        <h1 className="mt-3 font-broadcast text-4xl leading-tight text-white">
          Termos e Condições de Uso
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-invert mt-10 max-w-none space-y-8 text-[15px] leading-relaxed text-white/80">
          <section>
            <h2 className="font-broadcast text-xl text-white">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar, cadastrar-se ou utilizar a plataforma KMKZ Streaming
              (“KMKZ”, “Plataforma”, “nós”), você (“Usuário”) declara ter lido,
              compreendido e concordado integralmente com estes Termos e
              Condições de Uso, bem como com a nossa{" "}
              <Link to="/privacidade" className="text-[color:var(--color-tally)] underline">
                Política de Privacidade
              </Link>
              . Caso não concorde com qualquer disposição, você não deve
              utilizar a Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">2. Natureza do Serviço</h2>
            <p>
              A KMKZ oferece assinaturas de acesso a um catálogo digital de
              conteúdo audiovisual e um programa de fidelidade baseado em
              indicações e pontos. A KMKZ atua exclusivamente como
              intermediadora tecnológica de acesso a sinais e conteúdos
              licenciados e/ou disponibilizados por terceiros, não sendo
              produtora, editora ou responsável primária pelo conteúdo
              transmitido.
            </p>
            <p>
              A disponibilidade de canais, programas, filmes e demais conteúdos
              pode variar sem aviso prévio em razão de decisões de licenciantes,
              titulares de direitos, provedores de sinal ou determinações
              legais.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">3. Cadastro e Conta</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Você deve ter no mínimo 18 anos ou estar assistido por responsável legal.</li>
              <li>É obrigatório fornecer informações verdadeiras, completas e atualizadas.</li>
              <li>
                A conta é pessoal e intransferível. É vedado o compartilhamento
                de credenciais com terceiros fora dos limites técnicos previstos
                pelo plano contratado (uso em até 2 telas simultâneas por
                assinatura, no mesmo núcleo familiar).
              </li>
              <li>
                Você é integralmente responsável por toda atividade realizada
                na sua conta e deve nos comunicar imediatamente qualquer uso
                não autorizado.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">4. Planos, Pagamentos e Renovação</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Os planos disponíveis (Mensal, Trimestral, Semestral e Anual)
                são cobrados de forma antecipada, conforme valores exibidos no
                momento da contratação.
              </li>
              <li>
                Preços, benefícios e composição de planos podem ser alterados a
                qualquer tempo, sendo o Usuário notificado com antecedência
                razoável antes da próxima renovação.
              </li>
              <li>
                A confirmação de acesso está condicionada à compensação efetiva
                do pagamento pela instituição financeira ou gateway responsável
                (Pix, cartão ou outros métodos disponíveis).
              </li>
              <li>
                Em caso de estorno, chargeback ou fraude, a KMKZ poderá
                suspender ou cancelar imediatamente o acesso e estornar pontos
                creditados vinculados à transação.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">5. Direito de Arrependimento e Reembolso</h2>
            <p>
              Nos termos do art. 49 do Código de Defesa do Consumidor, o
              Usuário poderá exercer o direito de arrependimento em até 7
              (sete) dias corridos contados da data da contratação, desde que o
              serviço ainda não tenha sido efetivamente usufruído de forma
              relevante. Consumo comprovado de conteúdo poderá ensejar o
              reembolso proporcional aos dias não utilizados, a critério da
              KMKZ e conforme análise caso a caso.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">6. Programa de Indicações e Pontos</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Pontos são creditados apenas mediante indicação legítima, com
                assinatura paga e confirmada do indicado através do link
                exclusivo.
              </li>
              <li>Autoindicação, contas duplicadas, CPFs repetidos ou fraudes anulam créditos e podem gerar banimento definitivo.</li>
              <li>Pontos não têm valor monetário, não podem ser convertidos em dinheiro, transferidos entre contas ou negociados.</li>
              <li>Pontos expiram em 12 (doze) meses a contar da data de crédito.</li>
              <li>
                Em caso de cancelamento, chargeback ou fraude de uma
                assinatura, os pontos correspondentes serão automaticamente
                estornados.
              </li>
              <li>
                A KMKZ se reserva o direito de alterar, suspender ou encerrar o
                programa de recompensas a qualquer tempo, respeitando os pontos
                já validamente adquiridos.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">7. Prêmios Físicos</h2>
            <p>
              O resgate de prêmios físicos (como TV Sticks e demais
              dispositivos) exige endereço válido no território nacional. Prazo
              médio de envio: 15 a 30 dias úteis após a validação. Frete e
              tributos, quando aplicáveis, são de responsabilidade da KMKZ,
              salvo indicação diversa no ato do resgate. Prêmios não são
              trocados por dinheiro.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">8. Uso Aceitável</h2>
            <p>É expressamente proibido:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Redistribuir, retransmitir, gravar, revender ou explorar comercialmente o conteúdo da Plataforma.</li>
              <li>Realizar engenharia reversa, scraping massivo, contornar mecanismos de segurança, DRM ou limitação de dispositivos.</li>
              <li>Utilizar bots, automações ou VPNs com o objetivo de burlar controles, regiões, contagem de telas ou o programa de indicações.</li>
              <li>Praticar qualquer conduta ilegal, ofensiva, discriminatória ou que viole direitos de terceiros.</li>
            </ul>
            <p>
              O descumprimento poderá gerar suspensão imediata, cancelamento
              sem reembolso e adoção das medidas cíveis e criminais cabíveis.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">9. Propriedade Intelectual</h2>
            <p>
              Marca, layout, código, identidade visual, textos e demais
              elementos da Plataforma são de titularidade exclusiva da KMKZ ou
              licenciados a ela. Nenhuma disposição destes Termos transfere ao
              Usuário qualquer direito de propriedade intelectual, sendo
              concedida apenas uma licença pessoal, limitada, revogável e
              intransferível de uso para os fins previstos aqui.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">10. Disponibilidade e Suporte</h2>
            <p>
              Empregamos esforços razoáveis para manter a Plataforma disponível
              24/7, mas não garantimos operação ininterrupta ou livre de
              falhas. Manutenções programadas, indisponibilidades de
              provedores, falhas de internet do Usuário, quedas de energia ou
              casos fortuitos e de força maior não geram direito a reembolso,
              indenização ou extensão automática de plano, salvo quando
              expressamente previsto em lei.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">11. Limitação de Responsabilidade</h2>
            <p>
              Na máxima extensão permitida pela legislação aplicável, a KMKZ
              não responde por danos indiretos, lucros cessantes, perda de
              dados, prejuízos morais reflexos ou danos decorrentes de: (i)
              conteúdo de terceiros; (ii) uso indevido da conta pelo Usuário
              ou por quem tenha obtido suas credenciais; (iii) equipamentos,
              redes ou dispositivos do Usuário; (iv) decisões dos titulares de
              direitos que impactem o catálogo; (v) suspensão de serviço por
              atualização, segurança ou determinação legal.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">12. Suspensão e Encerramento</h2>
            <p>
              A KMKZ poderá suspender ou encerrar contas, planos e resgates,
              com ou sem aviso prévio, em caso de violação destes Termos,
              suspeita fundada de fraude, ordem judicial ou risco à
              integridade da Plataforma e de outros usuários.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">13. Alterações destes Termos</h2>
            <p>
              Estes Termos podem ser atualizados a qualquer momento. Alterações
              relevantes serão comunicadas via e-mail cadastrado e/ou aviso na
              Plataforma. O uso continuado após a vigência da nova versão
              implica aceitação.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">14. Legislação e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do
              Brasil. Fica eleito o foro do domicílio do Usuário para dirimir
              controvérsias, quando aplicável a legislação consumerista, sem
              prejuízo de eventual solução consensual via canais oficiais de
              atendimento.
            </p>
          </section>

          <section>
            <h2 className="font-broadcast text-xl text-white">15. Contato</h2>
            <p>
              Dúvidas sobre estes Termos podem ser encaminhadas ao suporte
              oficial:{" "}
              <a href="mailto:suporte@kmkzstream.lovable.app" className="text-[color:var(--color-tally)] underline">
                suporte@kmkzstream.lovable.app
              </a>
              .
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
