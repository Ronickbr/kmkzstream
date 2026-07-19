import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { getMyOverview } from "@/lib/user.functions";
import { cancelMySubscription } from "@/lib/subscriptions.functions";
import { formatCurrencyBRL, formatDateBR, formatPoints, PLAN_PERIOD_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { Sparkles, Users, Gift, CreditCard } from "lucide-react";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, refetch } = useSuspenseQuery(overviewQO);
  const cancelFn = useServerFn(cancelMySubscription);

  const activeSub = data.subscription?.status === "active" ? data.subscription : null;
  const confirmedRefs = data.referrals.filter((r) => r.status === "confirmed").length;

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

  return (
    <div className="min-h-dvh bg-surface-50">
      <AppNav isAdmin={data.isAdmin} />
      <main id="main" className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">
            Olá, {data.profile?.display_name ?? "usuário"}
          </h1>
          <p className="mt-1 text-sm text-surface-900/60">Visão geral da sua conta e recompensas.</p>
        </header>

        {/* Bento stats */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white lg:col-span-2 lg:row-span-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Seus pontos</p>
                <p className="mt-2 font-display text-6xl font-bold">{formatPoints(data.points)}</p>
              </div>
              <Sparkles className="size-6 text-white/60" />
            </div>
            <p className="mt-4 text-sm text-white/70">
              Continue indicando amigos para acumular mais pontos e resgatar prêmios exclusivos.
            </p>
            <Link
              to="/premios"
              className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-white/90"
            >
              Ver catálogo de prêmios
            </Link>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-6">
            <div className="flex items-center gap-2 text-surface-900/60">
              <Users className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Indicações</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{data.referrals.length}</p>
            <p className="text-xs text-surface-900/60">
              {confirmedRefs} confirmadas
            </p>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-6">
            <div className="flex items-center gap-2 text-surface-900/60">
              <Gift className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Resgates</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{data.redemptions.length}</p>
            <p className="text-xs text-surface-900/60">
              {data.redemptions.filter((r) => r.status === "delivered").length} entregues
            </p>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-6 md:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-surface-900/60">
              <CreditCard className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Assinatura</span>
            </div>
            {activeSub && activeSub.plan ? (
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{activeSub.plan.name}</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    ATIVA
                  </span>
                </div>
                <p className="mt-1 text-sm text-surface-900/60">
                  {formatCurrencyBRL(activeSub.plan.price_cents)} · {PLAN_PERIOD_LABEL[activeSub.plan.period]}
                </p>
                <p className="mt-2 text-xs text-surface-900/60">
                  Renova em {formatDateBR(activeSub.ends_at)}
                </p>
                <button
                  onClick={handleCancel}
                  className="mt-3 text-xs font-semibold text-red-600 hover:underline"
                >
                  Cancelar assinatura
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-surface-900/60">Você ainda não tem uma assinatura ativa.</p>
                <Link to="/planos" className="mt-3 inline-block text-sm font-bold text-brand">
                  Escolher plano →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Atividade recente */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-surface-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold">Indicações recentes</h2>
            {data.referrals.length === 0 ? (
              <p className="mt-4 text-sm text-surface-900/60">
                Nenhuma indicação ainda.{" "}
                <Link to="/indicacoes" className="font-bold text-brand">Compartilhe seu link</Link>.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.referrals.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span>{(r.referred as any)?.display_name ?? "Usuário"}</span>
                    <div className="flex items-center gap-3">
                      {r.status === "confirmed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          +{r.points_awarded} pts
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold text-surface-900/60">
                          PENDENTE
                        </span>
                      )}
                      <span className="text-xs text-surface-900/40">{formatDateBR(r.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold">Resgates recentes</h2>
            {data.redemptions.length === 0 ? (
              <p className="mt-4 text-sm text-surface-900/60">Você ainda não resgatou nenhum prêmio.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.redemptions.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span>{(r.reward as any)?.name ?? "Prêmio"}</span>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                        −{r.points_spent} pts
                      </span>
                      <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold uppercase text-surface-900/60">
                        {r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
