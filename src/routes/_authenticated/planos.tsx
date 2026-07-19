import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listActivePlans } from "@/lib/plans.functions";
import { getMyOverview } from "@/lib/user.functions";
import { formatCurrencyBRL, formatDateBR, PLAN_ECONOMY_LABEL, PLAN_PERIOD_SHORT } from "@/lib/format";
import { Check, Sparkles, CalendarClock, CheckCircle2, ArrowRight, Zap } from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });
const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({ meta: [{ title: "Planos — Nexus" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(plansQO),
    context.queryClient.ensureQueryData(overviewQO),
  ]),
  component: PlanosPage,
});

function PlanosPage() {
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: overview } = useSuspenseQuery(overviewQO);
  const sub = overview.subscription;
  const isActive = sub?.status === "active";
  const currentPlanId = isActive ? sub?.plan?.id : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Zap className="size-3.5 text-primary" aria-hidden="true" />
          Assinatura
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os planos incluem o programa de indicações e prêmios.
        </p>
      </header>

      {/* Assinatura atual */}
      <section
        aria-labelledby="current-sub-heading"
        className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6"
      >
        <h2 id="current-sub-heading" className="sr-only">Sua assinatura atual</h2>
        {isActive ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Plano atual</p>
                <p className="mt-1 font-display text-lg font-bold text-foreground">{sub?.plan?.name}</p>
                {sub?.ends_at && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    Ativo até {formatDateBR(sub.ends_at)}
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/minha-conta"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-4 text-sm font-semibold text-foreground hover:bg-background/80"
            >
              Gerenciar
            </Link>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sem assinatura ativa</p>
                <p className="mt-1 font-display text-lg font-bold text-foreground">Escolha um plano abaixo</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ative para começar a acumular pontos por indicações.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Grid de planos */}
      <div className="mx-auto flex flex-wrap justify-center gap-6 [&>*]:w-full [&>*]:sm:w-[calc(50%-0.75rem)] [&>*]:lg:w-[calc(25%-1.125rem)] [&>*]:lg:max-w-xs">
        {plans.map((p, idx) => {
          const popular = idx === 2;
          const isCurrent = p.id === currentPlanId;
          const economy = PLAN_ECONOMY_LABEL[p.period];
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl bg-card p-6 transition sm:p-7 ${
                isCurrent
                  ? "border-2 border-emerald-500/60 shadow-2xl shadow-emerald-500/10"
                  : popular
                  ? "border-2 border-primary shadow-2xl shadow-primary/10"
                  : "border border-border/60 hover:border-primary/40"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase text-white">
                  Plano atual
                </div>
              )}
              {!isCurrent && popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase text-primary-foreground">
                  Mais popular
                </div>
              )}
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
                  {formatCurrencyBRL(p.price_cents)}
                </span>
                <span className="text-xs text-muted-foreground">{PLAN_PERIOD_SHORT[p.period]}</span>
              </div>
              {economy && <p className="mt-1 text-xs font-semibold text-accent">{economy}</p>}

              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-foreground/80">
                {(p.features as string[]).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 rounded-xl bg-accent/10 px-2 py-1.5 font-medium text-accent">
                  <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>Ganhe {(p as any).purchase_points ?? 0} pts ao assinar</span>
                </li>
              </ul>

              {isCurrent ? (
                <div className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-3 text-sm font-bold text-emerald-400">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Você está neste plano
                </div>
              ) : (
                <Link
                  to="/checkout/$planId"
                  params={{ planId: p.id }}
                  className={`mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                    popular
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-background/50 text-foreground hover:bg-background"
                  }`}
                >
                  {isActive ? "Trocar plano" : "Assinar"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Cancele quando quiser. Sem taxas ocultas. Pagamentos processados com segurança.
      </p>
    </div>
  );
}
