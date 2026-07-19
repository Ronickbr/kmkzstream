# Plano: Plataforma de Assinatura + Programa de Indicações

Plataforma com landing page pública, área do usuário e painel administrativo. O usuário escolhe um plano, "paga" (simulado) e, dentro do painel, gerencia suas indicações — quanto mais indicações, mais pontos, e mais pontos desbloqueiam melhores prêmios.

## Backend (Lovable Cloud)

Ativação do Lovable Cloud para autenticação e banco de dados.

**Autenticação:** e-mail/senha + Google.

**Tabelas:**
- `profiles` — nome de exibição, avatar, `referral_code` (código único gerado no signup). Criada via trigger em `auth.users`.
- `user_roles` — enum `app_role` (`admin`, `user`) + função `has_role()` SECURITY DEFINER (padrão anti-recursão de RLS).
- `plans` — id, nome, período (`monthly`/`quarterly`/`semiannual`/`annual`), preço, features (jsonb). Seed: R$ 35 / R$ 99 / R$ 180 / R$ 300.
- `subscriptions` — user_id, plan_id, status (`active`/`canceled`/`expired`), `starts_at`, `ends_at`.
- `referrals` — `referrer_id` (quem indicou), `referred_id` (quem foi indicado), `status` (`pending`/`confirmed`), `points_awarded`, `created_at`. Uma indicação vira `confirmed` quando o indicado assina qualquer plano.
- `user_points` — user_id, `total_points`, `updated_at`. Atualizada por trigger quando uma referral vira `confirmed`.
- `rewards` — nome, descrição, imagem, `points_cost`, `stock`, ativo.
- `reward_redemptions` — user_id, reward_id, `points_spent`, `status` (`pending`/`delivered`/`canceled`), criado em.

**RLS:**
- `plans`, `rewards` — leitura pública; escrita só admin.
- `profiles` — leitura pública restrita a colunas seguras (nome, avatar); update só do dono.
- `subscriptions`, `referrals`, `user_points`, `reward_redemptions` — usuário vê só o próprio; admin vê tudo.
- `user_roles` — leitura autenticada via `has_role`; escrita só admin.

## Rotas

**Públicas**
- `/` — landing: hero, como funciona (3 passos: assine → indique → ganhe prêmios), destaque dos 4 planos, prévia dos prêmios, CTA.
- `/planos` — comparativo detalhado dos 4 planos com botão "Assinar".
- `/auth` — login e cadastro. Aceita `?ref=CODIGO` na URL para vincular quem indicou (grava a intenção antes do signup e cria a referral após confirmar).

**Autenticadas (`_authenticated/`)**
- `/dashboard` — visão geral: plano atual, saldo de pontos, total de indicações, próximo prêmio ao alcance.
- `/checkout/$planId` — resumo do plano + botão "Confirmar assinatura" (simulado). Cria linha em `subscriptions`, confirma referral pendente do indicador (se existir) e credita pontos.
- `/indicacoes` — código de indicação do usuário + link pronto para copiar/compartilhar, lista das próprias indicações (pendentes e confirmadas), histórico de pontos ganhos.
- `/premios` — catálogo de prêmios com custo em pontos; botão "Resgatar" (habilita quando o saldo cobre). Resgate cria `reward_redemptions` e debita pontos.
- `/minha-conta` — editar perfil (nome, avatar), ver assinatura ativa, cancelar.

**Admin (`_authenticated/admin/`, gate por `has_role('admin')`)**
- `/admin` — dashboard: totais de usuários, assinaturas ativas, receita simulada, indicações confirmadas, resgates pendentes.
- `/admin/planos` — CRUD dos 4 planos (preço, features).
- `/admin/premios` — CRUD do catálogo de prêmios (nome, custo em pontos, estoque, imagem).
- `/admin/usuarios` — lista com plano, pontos, número de indicações; promover a admin.
- `/admin/resgates` — fila de resgates; marcar como entregue ou cancelar.

## Regras de pontuação

- Cada indicação confirmada (indicado assinou qualquer plano) = **pontos configuráveis por plano** (default: mensal 10, trimestral 30, semestral 60, anual 100).
- Pontos são creditados automaticamente por trigger quando `referrals.status` vira `confirmed`.
- Resgatar prêmio debita `points_cost` do saldo; a operação é atômica (função SQL) para evitar saldo negativo em concorrência.

## Fluxo de indicação

1. Usuário A copia link `/{origem}/?ref=CODIGO_A` em `/indicacoes`.
2. Usuário B abre o link → vai para `/auth?ref=CODIGO_A` → o código é guardado (localStorage) e cria referral `pending` após signup.
3. Usuário B assina um plano em `/checkout/$planId` → referral vira `confirmed` → pontos vão para A.

## Design

Moderno, dark mode padrão, acento de destaque vivo (ex: violeta ou verde limão), tipografia sans bold, cards com hover elegante, gráficos limpos no dashboard (números grandes, barras de progresso para "faltam X pontos para o próximo prêmio").

## Notas técnicas

- Placeholder atual em `src/routes/index.tsx` vira a landing page.
- Server functions com `requireSupabaseAuth` para tudo autenticado; reads públicos (planos, prêmios na landing) via cliente publishable server-side.
- Loaders públicos não chamam funções autenticadas (evita 401 no SSR/prerender).
- Sem cobrança real — Stripe pode ser adicionado depois.

## Fora do escopo desta primeira entrega

- Cobrança real (Stripe/Paddle)
- Envio automatizado de e-mails
- Upload de imagens de prêmios via storage (usar URL por enquanto)
- Regras de expiração/renovação automática de assinatura