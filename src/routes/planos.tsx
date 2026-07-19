import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { listActivePlans } from "@/lib/plans.functions";
import { formatCurrencyBRL, PLAN_ECONOMY_LABEL, PLAN_PERIOD_SHORT } from "@/lib/format";
import { Check, Sparkles } from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Nexus" },
      { name: "description", content: "Escolha entre planos mensal, trimestral, semestral ou anual. Ganhe pontos por indicação e resgate prêmios." },
      { property: "og:title", content: "Planos — Nexus" },
      { property: "og:description", content: "Assine e comece a acumular pontos por indicação." },
      { property: "og:url", content: "/planos" },
    ],
    links: [{ rel: "canonical", href: "/planos" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQO),
  component: PlanosPage,
});

function PlanosPage() {
  const { data: plans } = useSuspenseQuery(plansQO);
  return (
    <div className="min-h-dvh bg-surface-50">
      <SiteNav />
      <div role="main" id="main" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="font-display text-4xl font-bold md:text-5xl">Planos de assinatura</h1>
          <p className="mt-3 text-surface-900/60">Todos os planos incluem o programa de indicações.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, idx) => {
            const popular = idx === 2;
            const economy = PLAN_ECONOMY_LABEL[p.period];
            return (
              <div
                key={p.id}
                className={`relative rounded-3xl bg-card p-8 transition ${
                  popular ? "border-2 border-brand shadow-2xl shadow-brand/10" : "group border border-surface-200 hover:border-brand/30 hover:shadow-xl"
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
                    <span>+{p.referral_points} pts por indicação</span>
                  </li>
                </ul>
                <Link
                  to="/checkout/$planId"
                  params={{ planId: p.id }}
                  className={`mt-8 flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold transition ${
                    popular ? "bg-brand text-brand-foreground hover:bg-brand-dark" : "border border-surface-200 group-hover:bg-surface-900 group-hover:text-white"
                  }`}
                >
                  Assinar
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
