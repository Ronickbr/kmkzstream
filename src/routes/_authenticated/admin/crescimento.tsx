import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getGrowthMetrics } from "@/lib/points.functions";
import { formatCurrencyBRL, formatPoints } from "@/lib/format";
import { BarChart3, DollarSign, Sparkles, TrendingUp } from "lucide-react";

const growthQO = queryOptions({ queryKey: ["admin", "growth"], queryFn: () => getGrowthMetrics() });

export const Route = createFileRoute("/_authenticated/admin/crescimento")({
  loader: ({ context }) => context.queryClient.ensureQueryData(growthQO),
  component: GrowthPage,
});

function GrowthPage() {
  const { data } = useSuspenseQuery(growthQO);

  const maxRevenue = Math.max(1, ...data.months.map((m) => m.revenue_cents));
  const maxUsers = Math.max(1, ...data.months.map((m) => m.new_users));

  const cards = [
    { label: "MRR estimado", value: formatCurrencyBRL(data.mrr_cents), icon: DollarSign, tone: "text-emerald-400" },
    { label: "Pontos em circulação", value: formatPoints(data.total_points_outstanding), icon: Sparkles, tone: "text-accent" },
    { label: "Pontos concedidos (total)", value: formatPoints(data.total_points_awarded), icon: TrendingUp, tone: "text-brand" },
  ];

  const monthLabel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-black tracking-tight">
          <BarChart3 className="size-7 text-brand" aria-hidden="true" /> Crescimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Métricas financeiras e de engajamento dos últimos 6 meses.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-6">
            <div className={`flex items-center gap-2 ${c.tone}`}>
              <c.icon className="size-4" aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-widest">{c.label}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-black">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 card-surface p-6">
        <h2 className="font-display text-lg font-bold">Receita por mês</h2>
        <p className="text-xs text-muted-foreground">Assinaturas ativadas por período.</p>
        <div className="mt-6 flex h-56 items-end gap-3">
          {data.months.map((m) => {
            const h = Math.max(4, Math.round((m.revenue_cents / maxRevenue) * 100));
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-brand to-brand-light transition-all"
                    style={{ height: `${h}%` }}
                    title={formatCurrencyBRL(m.revenue_cents)}
                  />
                </div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">{monthLabel(m.month)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 card-surface p-6">
        <h2 className="font-display text-lg font-bold">Novos usuários por mês</h2>
        <div className="mt-6 flex h-56 items-end gap-3">
          {data.months.map((m) => {
            const h = Math.max(4, Math.round((m.new_users / maxUsers) * 100));
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-accent to-amber-300 transition-all"
                    style={{ height: `${h}%` }}
                    title={`${m.new_users} usuários`}
                  />
                </div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">{monthLabel(m.month)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Mês</th>
                <th className="px-4 py-3 text-right">Novos usuários</th>
                <th className="px-4 py-3 text-right">Novas assinaturas</th>
                <th className="px-4 py-3 text-right">Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {data.months.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-3 font-semibold">{monthLabel(m.month)}</td>
                  <td className="px-4 py-3 text-right">{m.new_users}</td>
                  <td className="px-4 py-3 text-right">{m.new_subscriptions}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrencyBRL(m.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
