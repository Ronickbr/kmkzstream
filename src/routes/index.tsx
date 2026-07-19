import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listActivePlans, listActiveRewards } from "@/lib/plans.functions";
import { formatCurrencyBRL, formatPoints, PLAN_ECONOMY_LABEL, PLAN_PERIOD_SHORT } from "@/lib/format";
import { ArrowRight, Check, Gift, UserPlus, Sparkles, ShieldCheck, Zap, Trophy, Menu, X } from "lucide-react";

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

function DarkNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Nexus - página inicial">
          <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30" />
          <span className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">NEXUS</span>
        </Link>
        <div className="hidden gap-6 text-sm font-medium md:flex lg:gap-8">
          <Link to="/" hash="planos" className="text-slate-300 transition-colors hover:text-white">Planos</Link>
          <Link to="/" hash="premios" className="text-slate-300 transition-colors hover:text-white">Prêmios</Link>
          <Link to="/" hash="como-funciona" className="text-slate-300 transition-colors hover:text-white">Como funciona</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 sm:px-5 sm:text-sm"
            >
              Meu Painel
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm font-semibold text-slate-200 hover:text-white sm:inline">Entrar</Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95 sm:px-5 sm:text-sm"
              >
                Começar
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            className="ml-1 grid size-10 place-items-center rounded-lg text-slate-200 hover:bg-slate-800 md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-slate-800/60 bg-slate-950 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <Link to="/" hash="planos" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Planos</Link>
            <Link to="/" hash="premios" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Prêmios</Link>
            <Link to="/" hash="como-funciona" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Como funciona</Link>
            {!signedIn && (
              <Link to="/auth" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Entrar</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function DarkFooter() {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950 py-10 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700" />
          <span className="font-display text-lg font-bold tracking-tight text-white">NEXUS</span>
        </div>
        <p className="text-xs text-slate-500 sm:text-sm">© {new Date().getFullYear()} Nexus. Todos os direitos reservados.</p>
        <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-400 sm:gap-6">
          <a href="#" className="hover:text-white">Termos</a>
          <a href="#" className="hover:text-white">Privacidade</a>
          <a href="#" className="hover:text-white">Suporte</a>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: rewards } = useSuspenseQuery(rewardsQO);

  return (
    <div className="min-h-dvh bg-slate-950 font-sans text-slate-50 selection:bg-indigo-500/40">
      <DarkNav />

      <main id="main">
        {/* Hero */}
        <header className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.18),transparent_55%)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/3 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px] sm:h-96 sm:w-96"
          />
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center animate-fade-in">
            <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 sm:mb-8 sm:text-sm">
              <span aria-hidden="true" className="flex size-2 shrink-0 rounded-full bg-indigo-400 animate-pulse" />
              <span className="truncate">Novo: Programa de Prêmios Nexus</span>
            </div>
            <h1 className="mb-5 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl">
              Sua assinatura que{" "}
              <span className="text-amber-400">gera conquistas</span>
            </h1>
            <p className="mb-8 max-w-2xl text-base text-slate-300 sm:mb-10 sm:text-lg">
              Assine a Nexus, indique seus amigos e acumule pontos que podem ser trocados por prêmios exclusivos.
              A plataforma onde sua lealdade é recompensada.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 sm:px-8 sm:text-base"
              >
                Começar agora <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/"
                hash="premios"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95 sm:px-8 sm:text-base"
              >
                Ver prêmios
              </Link>
            </div>

            {/* Trust strip */}
            <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 border-t border-slate-800 pt-6 sm:mt-14 sm:grid-cols-3 sm:gap-6 sm:pt-8">
              {[
                { icon: ShieldCheck, label: "Pagamento seguro" },
                { icon: Zap, label: "Ativação imediata" },
                { icon: Trophy, label: "Prêmios reais" },
              ].map((t) => (
                <div key={t.label} className="flex items-center justify-center gap-2 text-xs text-slate-400 sm:text-sm">
                  <t.icon className="size-4 shrink-0 text-indigo-400" aria-hidden="true" />
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center sm:mb-16">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-400 sm:mb-4">Passo a passo</p>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Como o Nexus funciona</h2>
          </div>
          <div className="grid gap-5 sm:gap-8 md:grid-cols-3">
            {[
              { icon: Check, title: "Escolha seu plano", desc: "Assine um dos nossos planos e ganhe acesso imediato à plataforma e ao programa.", accent: "indigo" },
              { icon: UserPlus, title: "Indique amigos", desc: "Compartilhe seu link exclusivo. Cada novo assinante indicado vira pontos na sua conta.", accent: "amber" },
              { icon: Gift, title: "Troque por prêmios", desc: "Use seus pontos acumulados para resgatar equipamentos, descontos e experiências.", accent: "indigo" },
            ].map((s, i) => (
              <div
                key={s.title}
                className="group rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 sm:p-8"
              >
                <div
                  className={`mb-5 flex size-12 items-center justify-center rounded-2xl text-2xl font-bold italic transition-transform group-hover:scale-110 sm:mb-6 ${
                    s.accent === "amber" ? "bg-amber-500 text-slate-950" : "bg-indigo-600 text-white"
                  }`}
                >
                  0{i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold text-white sm:mb-3 sm:text-xl">
                  <s.icon className="mb-2 size-5 text-slate-500" aria-hidden="true" />
                  {s.title}
                </h3>
                <p className="text-sm text-slate-400 sm:text-base">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-3xl font-extrabold text-white sm:mb-4 sm:text-4xl">Planos flexíveis</h2>
            <p className="text-sm text-slate-400 sm:text-base">Escolha o período que melhor se adapta ao seu bolso.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {plans.map((p, idx) => {
              const popular = idx === 2;
              const economy = PLAN_ECONOMY_LABEL[p.period];
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-3xl p-6 transition-all sm:p-8 ${
                    popular
                      ? "border-2 border-indigo-500 bg-indigo-600/10 shadow-2xl shadow-indigo-500/20 lg:scale-105"
                      : "border border-slate-800 bg-slate-900/50 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10"
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-950 sm:px-4">
                      Mais popular
                    </span>
                  )}
                  <span className={`mb-4 text-sm font-medium ${popular ? "text-indigo-300" : "text-slate-400"}`}>{p.name}</span>
                  <div className="mb-6 flex flex-wrap items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white sm:text-4xl">{formatCurrencyBRL(p.price_cents)}</span>
                    <span className="text-sm text-slate-500">{PLAN_PERIOD_SHORT[p.period]}</span>
                  </div>
                  <ul className="mb-6 space-y-3 text-sm text-slate-300 sm:mb-8">
                    {economy && (
                      <li className="font-bold italic text-amber-400">{economy}</li>
                    )}
                    {(p.features as string[]).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-indigo-400" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2 font-medium">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
                      <span>+{p.referral_points} pts por indicação</span>
                    </li>
                  </ul>
                  <Link
                    to="/checkout/$planId"
                    params={{ planId: p.id }}
                    className={`mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-xl py-3 text-center text-sm font-bold transition-colors ${
                      popular
                        ? "bg-indigo-600 text-white hover:bg-indigo-500"
                        : "border border-slate-700 text-white hover:bg-slate-800"
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
        <section id="premios" className="bg-slate-900/30 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-12 sm:gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="mb-3 text-3xl font-extrabold text-white sm:mb-4 sm:text-4xl">O que você pode ganhar?</h2>
                <p className="text-sm text-slate-400 sm:text-base">Confira alguns dos prêmios disponíveis para troca imediata.</p>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="group inline-flex items-center gap-2 text-sm font-bold text-amber-400 transition-all hover:gap-3 hover:text-amber-300 sm:text-base"
              >
                Ver catálogo completo
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
              {rewards.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 transition-transform hover:-translate-y-1 sm:rounded-3xl"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute right-3 top-3 hidden size-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100 sm:right-4 sm:top-4 sm:flex sm:size-12"
                  >
                    <Gift className="size-5" />
                  </div>
                  <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 sm:text-xs">
                      {formatPoints(r.points_cost)} pts
                    </p>
                    <p className="line-clamp-2 text-sm font-bold text-white sm:text-base">{r.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-center shadow-2xl shadow-indigo-500/30 sm:rounded-[3rem] sm:p-12 md:p-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-amber-400/20 blur-3xl"
            />
            <h2 className="relative z-10 mb-4 text-2xl font-extrabold text-white sm:mb-6 sm:text-4xl md:text-5xl">
              Pronto para começar sua jornada Nexus?
            </h2>
            <p className="relative z-10 mx-auto mb-8 max-w-lg text-sm text-indigo-100 sm:mb-10 sm:text-lg">
              Junte-se a milhares de membros que já estão ganhando enquanto aproveitam o melhor conteúdo.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="relative z-10 inline-flex min-h-12 items-center justify-center rounded-2xl bg-card px-6 py-4 text-xs font-black uppercase tracking-wide text-indigo-900 shadow-xl transition hover:bg-slate-100 active:scale-95 sm:px-10 sm:py-5 sm:text-sm"
            >
              Quero me tornar assinante
            </Link>
          </div>
        </section>
      </main>

      <DarkFooter />
    </div>
  );
}
