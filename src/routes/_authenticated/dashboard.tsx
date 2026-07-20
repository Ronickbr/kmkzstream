import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyOverview } from "@/lib/user.functions";
import { cancelMySubscription } from "@/lib/subscriptions.functions";
import { getMyPointsHistory } from "@/lib/points.functions";
import { formatCurrencyBRL, formatDateBR, formatPoints, PLAN_PERIOD_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { Sparkles, Users, Gift, CreditCard, History, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { getVipLevel } from "@/lib/vip";
import { WelcomeTour } from "@/components/welcome-tour";
import { useState, useEffect } from "react";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });
const historyQO = queryOptions({ queryKey: ["me", "points-history"], queryFn: () => getMyPointsHistory() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(overviewQO),
      context.queryClient.ensureQueryData(historyQO),
    ]),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, refetch } = useSuspenseQuery(overviewQO);
  const { data: history } = useSuspenseQuery(historyQO);
  const cancelFn = useServerFn(cancelMySubscription);

  const activeSub = data.subscription?.status === "active" ? data.subscription : null;
  const confirmedRefs = data.referrals.filter((r) => r.status === "confirmed").length;

  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!(data.profile as any)?.onboarded_at) {
      const t = setTimeout(() => setTourOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [data.profile]);

  const handleCancel = async () => {
    if (!confirm("Cancelar assinatura atual?")) return;
    try {
      await cancelFn();
      toast.success("Assinatura cancelada");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };



  const vip = getVipLevel(data.points);
  const progress = vip.next ? Math.min(100, ((data.points - vip.min) / (vip.next - vip.min)) * 100) : 100;


  return (
    <div className="min-h-dvh">
      <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8 sm:mb-10">
          <p className="eyebrow">Painel</p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            Olá, <span className="text-gradient-brand">{data.profile?.display_name ?? "usuário"}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Aqui está a visão geral da sua conta, suas indicações e recompensas disponíveis.
          </p>
        </header>

        {/* Bento stats */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-6 text-white shadow-glow lg:col-span-2 lg:row-span-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Seus pontos</p>
                <p className="mt-3 font-display text-5xl font-black leading-none sm:text-6xl">
                  {formatPoints(data.points)}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                  <Trophy className="size-3.5" aria-hidden="true" /> {vip.emoji} {vip.name} VIP
                </div>
              </div>
              <span className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
            </div>
            {vip.next && (
              <div className="relative mt-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <span>Próximo nível</span>
                  <span>{vip.next - data.points} pts</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <p className="relative mt-6 max-w-sm text-sm leading-relaxed text-white/80">
              Continue indicando amigos para acumular mais pontos e resgatar prêmios exclusivos.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2">
              <Link
                to="/premios"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Catálogo de prêmios
              </Link>
              <Link
                to="/indicacoes"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Indicar amigos
              </Link>
            </div>
          </div>

          <div className="card-surface p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <span className="eyebrow">Indicações</span>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight">{data.referrals.length}</p>
            <p className="text-xs text-muted-foreground">{confirmedRefs} confirmadas</p>
          </div>

          <div className="card-surface p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
                <Gift className="size-4" aria-hidden="true" />
              </span>
              <span className="eyebrow">Resgates</span>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight">{data.redemptions.length}</p>
            <p className="text-xs text-muted-foreground">
              {data.redemptions.filter((r) => r.status === "delivered").length} entregues
            </p>
          </div>

          <div className="card-surface p-6 md:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CreditCard className="size-4" aria-hidden="true" />
              </span>
              <span className="eyebrow">Assinatura</span>
            </div>
            {activeSub && activeSub.plan ? (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-2xl font-bold">{activeSub.plan.name}</p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                    Ativa
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrencyBRL(activeSub.plan.price_cents)} · {PLAN_PERIOD_LABEL[activeSub.plan.period]}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Renova em {formatDateBR(activeSub.ends_at)}
                </p>
                <button
                  onClick={handleCancel}
                  className="mt-3 text-xs font-semibold text-destructive/90 transition hover:text-destructive hover:underline"
                >
                  Cancelar assinatura
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Você ainda não tem uma assinatura ativa.</p>
                <Link
                  to="/planos"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand transition hover:text-brand-dark"
                >
                  Escolher plano →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Atividade recente */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="card-surface p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Indicações recentes</h2>
              <Link to="/indicacoes" className="text-xs font-semibold text-brand hover:text-brand-dark">
                Ver todas →
              </Link>
            </div>
            {data.referrals.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border/80 bg-background/40 p-6 text-center">
                <Users className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma indicação ainda.{" "}
                  <Link to="/indicacoes" className="font-bold text-brand hover:underline">
                    Compartilhe seu link
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border/70">
                {data.referrals.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="truncate font-medium">
                      {r.referred_display_name ?? "Usuário"}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      {r.status === "confirmed" ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                          +{r.points_awarded} pts
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          Pendente
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateBR(r.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card-surface p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Resgates recentes</h2>
              <Link to="/premios" className="text-xs font-semibold text-brand hover:text-brand-dark">
                Ver catálogo →
              </Link>
            </div>
            {data.redemptions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border/80 bg-background/40 p-6 text-center">
                <Gift className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Você ainda não resgatou nenhum prêmio.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border/70">
                {data.redemptions.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="truncate font-medium">{(r.reward as any)?.name ?? "Prêmio"}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent ring-1 ring-inset ring-accent/30">
                        −{r.points_spent} pts
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Histórico de pontos */}
        <section className="mt-10 card-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <History className="size-4 text-brand" aria-hidden="true" />
              Histórico de pontos
            </h2>
            <span className="text-xs text-muted-foreground">Últimos {history.events.length} eventos</span>
          </div>
          {history.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 p-6 text-center text-sm text-muted-foreground">
              Nenhum evento ainda. Resgate o bônus diário ou indique amigos.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {history.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                        e.points >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {e.points >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.description ?? e.kind}</p>
                      <p className="text-xs text-muted-foreground">{formatDateBR(e.created_at)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${
                      e.points >= 0 ? "text-emerald-400" : "text-destructive"
                    }`}
                  >
                    {e.points >= 0 ? "+" : ""}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
