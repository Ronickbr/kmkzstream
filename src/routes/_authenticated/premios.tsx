import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { getMyOverview } from "@/lib/user.functions";
import { listActiveRewards } from "@/lib/plans.functions";
import { redeemReward } from "@/lib/redemptions.functions";
import { formatPoints } from "@/lib/format";
import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });
const rewardsQO = queryOptions({ queryKey: ["public", "rewards"], queryFn: () => listActiveRewards() });

export const Route = createFileRoute("/_authenticated/premios")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(overviewQO),
      context.queryClient.ensureQueryData(rewardsQO),
    ]),
  component: PremiosPage,
});

function PremiosPage() {
  const { data: overview, refetch: refetchOverview } = useSuspenseQuery(overviewQO);
  const { data: rewards, refetch: refetchRewards } = useSuspenseQuery(rewardsQO);
  const redeemFn = useServerFn(redeemReward);
  const [busy, setBusy] = useState<string | null>(null);

  const handleRedeem = async (rewardId: string) => {
    if (!confirm("Confirmar resgate?")) return;
    setBusy(rewardId);
    try {
      await redeemFn({ data: { rewardId } });
      toast.success("Resgate solicitado com sucesso!");
      await Promise.all([refetchOverview(), refetchRewards()]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao resgatar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-surface-50">
      <AppNav isAdmin={overview.isAdmin} />
      <main id="main" className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-bold">Catálogo de prêmios</h1>
            <p className="mt-1 text-sm text-surface-900/60">Troque seus pontos por recompensas.</p>
          </div>
          <div className="rounded-2xl bg-brand px-6 py-3 text-white shadow-lg shadow-brand/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Seus pontos</p>
            <p className="font-display text-2xl font-bold">{formatPoints(overview.points)}</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const affordable = overview.points >= r.points_cost;
            const inStock = r.stock > 0;
            const disabled = !affordable || !inStock || busy === r.id;
            return (
              <div key={r.id} className="flex flex-col rounded-3xl border border-surface-200 bg-white p-6">
                <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-accent/10">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <Gift className="size-12 text-brand/60" />
                  )}
                </div>
                <h3 className="font-display text-lg font-bold">{r.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-surface-900/60">{r.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">
                    <Sparkles className="size-3" /> {formatPoints(r.points_cost)} pts
                  </span>
                  <span className={inStock ? "text-surface-900/60" : "font-bold text-red-500"}>
                    {inStock ? `${r.stock} disponíveis` : "Esgotado"}
                  </span>
                </div>
                <button
                  onClick={() => handleRedeem(r.id)}
                  disabled={disabled}
                  className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-900/40"
                >
                  {busy === r.id
                    ? "Resgatando…"
                    : !inStock
                      ? "Esgotado"
                      : !affordable
                        ? `Faltam ${formatPoints(r.points_cost - overview.points)} pts`
                        : "Resgatar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
