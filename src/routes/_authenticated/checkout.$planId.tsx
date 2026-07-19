import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { listActivePlans } from "@/lib/plans.functions";
import { getMyOverview } from "@/lib/user.functions";
import { subscribeToPlan } from "@/lib/subscriptions.functions";
import { formatCurrencyBRL, PLAN_PERIOD_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import { Check, CreditCard, Lock } from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });
const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/checkout/$planId")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(overviewQO),
    ]),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { planId } = Route.useParams();
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: overview } = useSuspenseQuery(overviewQO);
  const subscribeFn = useServerFn(subscribeToPlan);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === planId);

  if (!plan) {
    return (
      <div className="min-h-screen bg-surface-50">
        <AppNav isAdmin={overview.isAdmin} />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Plano não encontrado</h1>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeFn({ data: { planId: plan.id } });
      toast.success(`Assinatura ${plan.name} ativada!`);
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ativar plano");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <AppNav isAdmin={overview.isAdmin} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold">Finalizar assinatura</h1>
        <p className="mt-1 text-sm text-surface-900/60">Confirme o plano selecionado e ative sua conta.</p>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-surface-200 bg-white p-8">
            <div className="mb-6 flex items-center gap-2 text-surface-900/60">
              <CreditCard className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Método de pagamento</span>
            </div>
            <div className="rounded-2xl border-2 border-dashed border-surface-200 p-6 text-center">
              <Lock className="mx-auto size-8 text-surface-900/30" />
              <p className="mt-3 font-bold">Pagamento simulado</p>
              <p className="mt-1 text-xs text-surface-900/60">
                Este é um ambiente de demonstração. A ativação será instantânea ao clicar em confirmar.
              </p>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <p className="font-semibold">O que está incluso:</p>
              <ul className="space-y-2">
                {(plan.features as string[]).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-surface-900/70">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-surface-900/70">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  +{plan.referral_points} pontos por indicação confirmada
                </li>
              </ul>
            </div>
          </div>

          <aside className="h-fit rounded-3xl bg-surface-900 p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Resumo</p>
            <h2 className="mt-2 font-display text-xl font-bold">Plano {plan.name}</h2>
            <p className="text-sm text-white/60">{PLAN_PERIOD_LABEL[plan.period]}</p>
            <div className="my-6 h-px bg-white/10" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">Total</span>
              <span className="font-display text-3xl font-bold">{formatCurrencyBRL(plan.price_cents)}</span>
            </div>
            <button
              onClick={handleSubscribe}
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Ativando…" : "Confirmar e ativar"}
            </button>
            <p className="mt-3 text-center text-[10px] text-white/40">
              Ao confirmar, você aceita nossos termos.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
