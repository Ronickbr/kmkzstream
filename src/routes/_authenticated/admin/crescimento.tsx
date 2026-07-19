import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getGrowthMetrics } from "@/lib/points.functions";
import { getAdminAnalytics } from "@/lib/admin.functions";
import { formatCurrencyBRL, formatPoints } from "@/lib/format";
import { BarChart3, DollarSign, Sparkles, TrendingUp, Users, Target, Gift, Trophy } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const growthQO = queryOptions({ queryKey: ["admin", "growth"], queryFn: () => getGrowthMetrics() });
const analyticsQO = queryOptions({ queryKey: ["admin", "analytics"], queryFn: () => getAdminAnalytics() });

export const Route = createFileRoute("/_authenticated/admin/crescimento")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(growthQO),
      context.queryClient.ensureQueryData(analyticsQO),
    ]),
  component: GrowthPage,
});

const COLORS = ["#9333ea", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

function GrowthPage() {
  const { data: growth } = useSuspenseQuery(growthQO);
  const { data: an } = useSuspenseQuery(analyticsQO);

  const monthLabel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  };
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const revenueData = growth.months.map((m) => ({
    month: monthLabel(m.month),
    receita: Math.round(m.revenue_cents / 100),
    usuarios: m.new_users,
    assinaturas: m.new_subscriptions,
  }));

  const signupData = an.daily_signups.map((d) => ({ day: dayLabel(d.day), signups: d.signups }));

  const cards = [
    { label: "MRR estimado", value: formatCurrencyBRL(growth.mrr_cents), icon: DollarSign, tone: "text-emerald-400" },
    { label: "Usuários ativos (30d)", value: String(an.active_users_30d), icon: Users, tone: "text-purple-400" },
    { label: "Conversão de indicações", value: `${an.referral_funnel.conversion_rate}%`, icon: Target, tone: "text-pink-400" },
    { label: "Pontos em circulação", value: formatPoints(growth.total_points_outstanding), icon: Sparkles, tone: "text-amber-400" },
  ];

  const tooltipStyle = {
    contentStyle: { background: "rgb(15 23 42 / 0.95)", border: "1px solid rgb(148 163 184 / 0.2)", borderRadius: 8 },
    labelStyle: { color: "rgb(226 232 240)" },
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="eyebrow">Admin · Analytics avançado</p>
        <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-black tracking-tight">
          <BarChart3 className="size-7 text-brand" aria-hidden="true" /> Crescimento & Métricas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão completa do desempenho, engajamento e retenção.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-6">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <TrendingUp className="size-4 text-brand" /> Receita (últimos 6 meses)
          </h2>
          <p className="text-xs text-muted-foreground">Em reais.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.1)" />
                <XAxis dataKey="month" tick={{ fill: "rgb(148 163 184)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgb(148 163 184)", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <Area type="monotone" dataKey="receita" stroke="#9333ea" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-surface p-6">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Users className="size-4 text-pink-400" /> Novos cadastros (30 dias)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.1)" />
                <XAxis dataKey="day" tick={{ fill: "rgb(148 163 184)", fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: "rgb(148 163 184)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="signups" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-surface p-6">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Target className="size-4 text-emerald-400" /> Distribuição de planos ativos
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={an.plan_distribution.filter((p) => p.count > 0)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e: any) => `${e.name}: ${e.count}`}
                >
                  {an.plan_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-surface p-6">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Gift className="size-4 text-amber-400" /> Funil de indicações & resgates
          </h2>
          <div className="mt-4 space-y-4">
            <FunnelRow label="Indicações pendentes" value={an.referral_funnel.pending} total={an.referral_funnel.total} color="bg-amber-500" />
            <FunnelRow label="Indicações confirmadas" value={an.referral_funnel.confirmed} total={an.referral_funnel.total} color="bg-emerald-500" />
            <div className="h-px bg-white/10 my-2" />
            <FunnelRow label="Resgates pendentes" value={an.redemption_funnel.pending} total={an.redemption_funnel.pending + an.redemption_funnel.fulfilled + an.redemption_funnel.cancelled} color="bg-purple-500" />
            <FunnelRow label="Resgates entregues" value={an.redemption_funnel.fulfilled} total={an.redemption_funnel.pending + an.redemption_funnel.fulfilled + an.redemption_funnel.cancelled} color="bg-pink-500" />
            <div className="pt-2 text-xs text-muted-foreground">
              Pontos gastos: <span className="text-foreground font-semibold">{formatPoints(an.redemption_funnel.points_spent)}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 card-surface p-6">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Trophy className="size-4 text-amber-400" /> Top 10 usuários por pontos
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Usuário</th>
                <th className="px-4 py-2 text-right">Pontos</th>
                <th className="px-4 py-2 text-right">Indicações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {an.top_users.map((u, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-mono text-brand">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold">{u.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPoints(u.total_points)}</td>
                  <td className="px-4 py-3 text-right">{u.referrals}</td>
                </tr>
              ))}
              {an.top_users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sem dados ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FunnelRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
