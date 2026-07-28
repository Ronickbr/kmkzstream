# KMKZ IPTV — Plataforma de Assinaturas & Programa de Indicações

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154?style=for-the-badge&logo=react-query&logoColor=white" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-ativo-success?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/licen%C3%A7a-propriet%C3%A1ria-lightgrey?style=flat-square" alt="Licença" />
  <img src="https://img.shields.io/badge/i18n-PT%20%7C%20EN%20%7C%20ES-blue?style=flat-square" alt="Idiomas" />
  <img src="https://img.shields.io/badge/pagamentos-InfinityPay%20%7C%20Stripe-9333ea?style=flat-square" alt="Pagamentos" />
  <img src="https://img.shields.io/badge/RLS-habilitado-3FCF8E?style=flat-square" alt="RLS" />
  <img src="https://img.shields.io/badge/PRs-bem--vindos-ec4899?style=flat-square" alt="PRs welcome" />
</p>

> Plataforma web moderna e gamificada de streaming/IPTV: landing page de alta conversão, checkout com múltiplos gateways, painel do assinante com programa de indicações, pontos, conquistas, prêmios e um painel administrativo completo.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Começando](#começando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Pagamentos e webhooks](#pagamentos-e-webhooks)
- [Internacionalização](#internacionalização)
- [Segurança](#segurança)
- [Scripts disponíveis](#scripts-disponíveis)
- [Deploy](#deploy)
- [Roadmap](#roadmap)
- [Licença](#licença)

---

## Visão geral

O KMKZ IPTV combina **assinatura recorrente** com um **programa de afiliados gamificado**. O assinante ganha pontos ao comprar um plano e ao indicar novos clientes (creditados apenas quando o pagamento do indicado é confirmado), sobe no ranking VIP, desbloqueia conquistas e troca pontos por prêmios — assinaturas grátis ou dispositivos físicos como Mi TV Stick e Fire TV Stick.

| Plano       | BRL       | USD       | Pontos pela compra |
| ----------- | --------- | --------- | ------------------ |
| Mensal      | R$ 34,90  | US$ 9,99  | 20 pts             |
| Trimestral  | R$ 94,90  | US$ 24,99 | 70 pts             |
| Semestral   | R$ 174,90 | US$ 44,99 | 150 pts            |
| Anual       | R$ 324,90 | US$ 79,99 | 350 pts            |

> Valores e pontuações são configuráveis no painel administrativo.

---

## Funcionalidades

### Público
- Landing page com estética "Broadcast/Control Room" (scanlines, ticker dinâmico, neon roxo/rosa).
- Grid de planos (Mensal · Trimestral · Semestral · Anual) com preços em BRL ou USD conforme o idioma.
- Páginas de **Termos e Condições** e **Política de Privacidade**.
- Cadastro dedicado com plano pré-selecionado, validação de CPF (checksum), WhatsApp, código de indicação opcional e medidor de força de senha.

### Área do assinante
- Dashboard com resumo de assinatura, pontos e progresso.
- **Indicações**: link/código exclusivo, compartilhamento nativo e via WhatsApp, status de cada indicação (pendente/confirmada/cancelada).
- **Pontos & Conquistas**: 15 conquistas, regras de pontuação configuráveis, histórico de eventos.
- **Ranking VIP** entre assinantes.
- **Prêmios**: resgate automático de assinaturas grátis e captura de endereço para dispositivos físicos.
- **Minha conta**: dados pessoais, WhatsApp, bio e troca de senha.
- Central de notificações in-app e tour guiado de onboarding.

### Administração
- CRUD completo de usuários com ações em lote (excluir, alternar admin).
- Gestão de planos, prêmios e regras de pontos.
- Fila de resgates, analytics de crescimento (recharts) e trilha de auditoria.
- Configuração de gateways de pagamento e lembretes de vencimento por WhatsApp.

---

## Stack tecnológica

| Camada          | Tecnologia                                                    |
| --------------- | ------------------------------------------------------------- |
| Framework       | TanStack Start (React 19 + TanStack Router, SSR)               |
| Build           | Vite 8                                                         |
| Linguagem       | TypeScript 5.8                                                 |
| Estilos         | Tailwind CSS 4 + shadcn/ui (Radix UI)                          |
| Dados           | TanStack Query 5 (`queryOptions` centralizados em `src/lib/queries.ts`) |
| Backend         | Server Functions (`createServerFn`) + Server Routes            |
| Banco / Auth    | Supabase (Postgres, RLS, Auth, Realtime)                       |
| Gráficos        | Recharts                                                       |
| Validação       | Zod + React Hook Form                                          |
| Notificações UI | Sonner                                                         |

---

## Arquitetura

```text
Browser (React 19 / TanStack Router)
  │  useSuspenseQuery + queryOptions
  ▼
Server Functions (createServerFn)          Server Routes (/api/public/*)
  │  requireSupabaseAuth (RLS como user)     │  webhooks · retorno de gateway
  ▼                                          ▼
                Supabase Postgres
     RLS · triggers anti-fraude · funções SECURITY DEFINER
```

Princípios adotados:

- Toda leitura sensível passa por server functions autenticadas; nada de chaves privilegiadas no cliente.
- Rotas protegidas ficam sob `src/routes/_authenticated/` (gate `ssr: false`).
- Endpoints externos ficam em `src/routes/api/public/*` e validam o chamador dentro do handler.
- Regras de negócio críticas (pontos, indicações, estornos) vivem em **triggers do banco**, não no front-end.

---

## Estrutura de pastas

```text
src/
├── components/          # Navegação, sidebar, notificações, tour, shadcn/ui
├── lib/
│   ├── *.functions.ts   # Server functions (planos, pontos, indicações, admin…)
│   ├── payments.ts      # Roteamento de gateway e montagem de links
│   ├── payments.server.ts # Verificação e confirmação de pagamento (server-only)
│   ├── queries.ts       # queryOptions e chaves de cache centralizadas
│   └── i18n.tsx         # Provider PT/EN/ES + hook tc()
├── routes/
│   ├── index.tsx        # Landing page
│   ├── cadastro.tsx     # Cadastro com plano selecionado
│   ├── auth.tsx         # Login
│   ├── termos.tsx · privacidade.tsx
│   ├── _authenticated/  # Área logada (dashboard, indicações, prêmios, checkout…)
│   │   └── admin/       # Painel administrativo
│   └── api/public/      # Webhooks e retorno de pagamento
└── integrations/supabase/  # Clientes gerados (não editar)

supabase/
└── schema/              # Schema portátil: prereqs, estrutura, seed, auth hooks
```

---

## Começando

### Pré-requisitos
- Node.js 20+ (ou Bun 1.1+)
- Um projeto Supabase (ou Lovable Cloud)

### Instalação

```bash
git clone <url-do-repositorio>
cd kmkz-iptv
bun install        # ou: npm install
bun run dev        # http://localhost:8080
```

---

## Variáveis de ambiente

| Variável                        | Escopo    | Descrição                                     |
| ------------------------------- | --------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`             | Cliente   | URL do projeto Supabase                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente   | Chave publicável (segura no browser)          |
| `SUPABASE_URL`                  | Servidor  | URL do projeto para server functions          |
| `SUPABASE_PUBLISHABLE_KEY`      | Servidor  | Chave publicável no runtime servidor          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Servidor  | Operações privilegiadas (webhooks, admin)     |
| `PAYMENT_WEBHOOK_SECRET`        | Servidor  | HMAC-SHA256 do webhook genérico de pagamentos |

> Segredos nunca são commitados: são injetados no runtime do servidor.

---

## Banco de dados

16 tabelas, 40+ funções e 49 políticas RLS. Principais entidades:

| Tabela                   | Função                                              |
| ------------------------ | --------------------------------------------------- |
| `profiles`               | Dados do usuário (CPF, WhatsApp, código de indicação) |
| `user_roles`             | Papéis (`admin`, `user`) — separados do perfil        |
| `plans`                  | Planos, preços e pontos por compra                    |
| `subscriptions`          | Assinaturas, status de pagamento e vigência           |
| `referrals`              | Indicações e seus status                              |
| `point_events` · `user_points` | Extrato e saldo de pontos                       |
| `achievements` · `user_achievements` | Conquistas desbloqueadas               |
| `rewards` · `reward_redemptions` | Catálogo e resgates                         |
| `notifications`          | Central de avisos in-app                              |
| `app_settings`           | Configurações de gateways e lembretes                 |
| `audit_logs`             | Trilha de ações sensíveis                             |
| `payment_webhook_events` | Idempotência e anti-replay de webhooks                |

O pacote portátil do schema fica em [`supabase/schema/`](supabase/schema) — permite recriar o banco do zero em qualquer instância Postgres/Supabase.

---

## Pagamentos e webhooks

Roteamento por localidade: **Brasil (BRL) → InfinityPay** · **Internacional (USD) → Stripe**, ambos configuráveis no painel admin.

| Endpoint                                     | Método | Descrição                                                           |
| -------------------------------------------- | ------ | ------------------------------------------------------------------- |
| `/api/public/payments/webhook`                | POST   | Webhook genérico com assinatura HMAC-SHA256 (`x-kmkz-signature`)     |
| `/api/public/payments/infinitepay/webhook`    | POST   | Webhook nativo InfinityPay + reconsulta oficial em `payment_check`   |
| `/api/public/payments/infinitepay/retorno`    | GET    | Callback do checkout: verifica, ativa a assinatura e redireciona     |

Proteções aplicadas: validação de campos obrigatórios, conferência do `handle`, verificação do valor pago contra o preço do plano, idempotência por evento e janela anti-replay. Pontos e acesso só são liberados após confirmação verificada.

---

## Internacionalização

Três idiomas completos — **Português**, **Inglês** e **Espanhol** — com moeda dinâmica (BRL/USD) e o hook `tc()` para traduzir conteúdo vindo do banco de dados.

---

## Segurança

- **RLS habilitado** em todas as tabelas, com políticas por proprietário/papel.
- Papéis em tabela dedicada (`user_roles`) + função `has_role` — sem escalonamento de privilégio.
- Funções `SECURITY DEFINER` com `EXECUTE` revogado de `PUBLIC`/`anon`.
- Triggers anti-fraude: bloqueio de autoindicação, CPF único, expiração de pontos, estorno em chargeback e prevenção de farming de assinaturas.
- Escrita direta em pontos, conquistas e resgates bloqueada pelo cliente.
- Sanitização de redirects, validação com Zod em todas as entradas e trilha de auditoria.

---

## Scripts disponíveis

| Comando             | Descrição                              |
| ------------------- | -------------------------------------- |
| `bun run dev`       | Servidor de desenvolvimento            |
| `bun run build`     | Build de produção                      |
| `bun run build:dev` | Build em modo desenvolvimento          |
| `bun run preview`   | Pré-visualização do build              |
| `bun run lint`      | ESLint                                 |
| `bun run format`    | Prettier                               |

---

## Deploy

A aplicação roda em runtime serverless (Cloudflare Workers via Lovable). Após o build, publique pela plataforma ou aponte seu provedor para o output do Vite. URLs estáveis para webhooks e cron:

```text
https://<projeto>.lovable.app                # produção
https://<projeto>--dev.lovable.app           # preview
```

---

## Roadmap

- [ ] Confirmação automática também para Stripe (webhook nativo)
- [ ] Envio automatizado dos lembretes de vencimento via WhatsApp API
- [ ] App mobile (PWA instalável)
- [ ] Relatórios exportáveis (CSV/PDF) no painel admin

---

## Licença

Projeto proprietário — todos os direitos reservados à KMKZ IPTV. Uso, cópia ou distribuição sem autorização expressa não são permitidos.

<p align="center">Feito com 💜 e muito neon.</p>
