import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { listActivePlans, listActiveRewards } from "@/lib/plans.functions";
import { formatCurrencyBRL, formatPoints, PLAN_ECONOMY_LABEL, PLAN_PERIOD_SHORT } from "@/lib/format";
import { ArrowRight, Check, Gift, UserPlus, Sparkles } from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });
const rewardsQO = queryOptions({ queryKey: ["public", "rewards"], queryFn: () => listActiveRewards() });

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(rewardsQO),
    ]);
  },
  component: LandingPage,
});

function LandingPage() {
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: rewards } = useSuspenseQuery(rewardsQO);

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden pt-20 pb-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand ring-1 ring-surface-200">
            <Sparkles className="size-3.5" /> Programa de indicações
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight md:text-7xl">
            Indique amigos. <br />
            <span className="text-brand">Ganhe recompensas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-surface-900/60">
            A plataforma de assinatura onde sua rede de contatos vale pontos que se transformam em experiências exclusivas e prêmios incríveis.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
            >
              Começar agora <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/planos"
              className="rounded-full border border-surface-200 bg-white px-6 py-3 text-sm font-semibold hover:bg-surface-100"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </header>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Como funciona</h2>
          <p className="mt-2 text-surface-900/60">3 passos simples para começar a ganhar prêmios.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Check, title: "Assine um plano", desc: "Escolha entre mensal, trimestral, semestral ou anual e ative sua conta." },
            { icon: UserPlus, title: "Indique amigos", desc: "Compartilhe seu código único. Cada indicação confirmada gera pontos." },
            { icon: Gift, title: "Resgate prêmios", desc: "Troque seus pontos por prêmios exclusivos no nosso catálogo." },
          ].map((s, i) => (
            <div key={s.title} className="rounded-3xl border border-surface-200 bg-white p-8">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <s.icon className="size-5" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-surface-900/40">Passo {i + 1}</div>
              <h3 className="font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-surface-900/60">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Nossos planos</h2>
          <p className="mt-2 text-surface-900/60">Escolha a recorrência que faz sentido para você.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, idx) => {
            const popular = idx === 2;
            const economy = PLAN_ECONOMY_LABEL[p.period];
            return (
              <div
                key={p.id}
                className={`relative rounded-3xl bg-white p-8 transition ${
                  popular
                    ? "border-2 border-brand shadow-2xl shadow-brand/10"
                    : "group border border-surface-200 hover:border-brand/30 hover:shadow-xl"
                }`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-[10px] font-bold uppercase text-white">
                    Mais popular
                  </div>
                )}
                <h3 className="text-sm font-bold uppercase tracking-widest text-surface-900/40">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{formatCurrencyBRL(p.price_cents)}</span>
                  <span className="text-surface-900/40">{PLAN_PERIOD_SHORT[p.period]}</span>
                </div>
                {economy && <p className="mt-2 text-xs font-semibold text-brand">{economy}</p>}
                <ul className="mt-6 space-y-3 text-sm text-surface-900/70">
                  {(p.features as string[]).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      <span>{f}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 font-medium">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>+{p.referral_points} pts por indicação confirmada</span>
                  </li>
                </ul>
                <Link
                  to="/checkout/$planId"
                  params={{ planId: p.id }}
                  className={`mt-8 flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold transition ${
                    popular
                      ? "bg-brand text-brand-foreground hover:bg-brand-dark"
                      : "border border-surface-200 group-hover:bg-surface-900 group-hover:text-white"
                  }`}
                >
                  Assinar
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Prêmios */}
      <section id="premios" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-3xl font-bold md:text-4xl">Prêmios em destaque</h2>
            <p className="mt-2 text-surface-900/60">Troque seus pontos por recompensas selecionadas.</p>
          </div>
          <Link to="/auth" search={{ mode: "signup" }} className="text-sm font-bold uppercase text-brand">
            Ver catálogo completo →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.slice(0, 6).map((r) => (
            <div key={r.id} className="rounded-3xl border border-surface-200 bg-white p-6 transition hover:shadow-lg">
              <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-accent/10">
                <Gift className="size-10 text-brand/60" />
              </div>
              <h3 className="font-bold">{r.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-surface-900/50">{r.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                  {formatPoints(r.points_cost)} pts
                </span>
                <span className="text-xs text-surface-900/40">{r.stock} disponíveis</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Painel admin preview */}
      <section className="bg-surface-900 py-24 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="flex flex-col justify-center">
              <h2 className="font-display text-4xl font-bold">Painel administrativo robusto</h2>
              <p className="mt-4 text-white/60">
                Gerencie assinaturas, valide indicações e controle seu estoque de prêmios em uma interface pensada para escala.
              </p>
              <div className="mt-10 space-y-6">
                {[
                  ["Gestão de planos", "Altere valores, benefícios e pontuação em tempo real."],
                  ["Controle de indicações", "Acompanhe o funil de indicações e conversões por usuário."],
                  ["Analytics", "Visualize receita, base ativa e resgates pendentes num só lugar."],
                ].map(([t, d]) => (
                  <div key={t} className="flex items-start gap-4">
                    <div className="mt-1 size-2 rounded-full bg-brand" />
                    <p className="text-sm"><strong>{t}:</strong> {d}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                <div className="size-3 rounded-full bg-red-500/50" />
                <div className="size-3 rounded-full bg-yellow-500/50" />
                <div className="size-3 rounded-full bg-green-500/50" />
                <span className="ml-4 font-mono text-[10px] text-white/20">Nexus Admin OS</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Receita ativa</p>
                  <p className="text-xl font-bold">R$ 42.840</p>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Retenção</p>
                  <p className="text-xl font-bold text-green-400">98.8%</p>
                </div>
                <div className="col-span-2 rounded-xl bg-white/5 p-4">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Indicações (30d)</p>
                  <div className="flex h-24 items-end gap-1">
                    {[40, 60, 45, 80, 100].map((h, i) => (
                      <div
                        key={i}
                        className={`w-full rounded-t-sm bg-brand`}
                        style={{ height: `${h}%`, opacity: 0.4 + i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
