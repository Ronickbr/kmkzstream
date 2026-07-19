import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAdminStats } from "@/lib/admin.functions";
import { formatCurrencyBRL } from "@/lib/format";
import { Users, CreditCard, DollarSign, Gift, TrendingUp } from "lucide-react";

const statsQO = queryOptions({ queryKey: ["admin", "stats"], queryFn: () => getAdminStats() });

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQO),
  component: AdminHome,
});

function AdminHome() {
  const { data: stats } = useSuspenseQuery(statsQO);

  const cards = [
    { label: "Usuários", value: stats.total_users, icon: Users, tone: "text-brand" },
    { label: "Assinaturas ativas", value: stats.active_subscriptions, icon: CreditCard, tone: "text-emerald-600" },
    { label: "Receita total", value: formatCurrencyBRL(stats.total_revenue_cents), icon: DollarSign, tone: "text-accent" },
    { label: "Indicações confirmadas", value: stats.confirmed_referrals, icon: TrendingUp, tone: "text-brand" },
    { label: "Resgates pendentes", value: stats.pending_redemptions, icon: Gift, tone: "text-amber-600" },
  ];

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Painel administrativo</h1>
      <p className="mt-1 text-sm text-surface-900/60">Visão geral da plataforma.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-surface-200 bg-white p-6">
            <div className={`flex items-center gap-2 ${c.tone}`}>
              <c.icon className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{c.label}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
