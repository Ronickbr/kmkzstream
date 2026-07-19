import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPlans, adminUpdatePlan } from "@/lib/admin.functions";
import { PLAN_PERIOD_LABEL } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

const plansQO = queryOptions({ queryKey: ["admin", "plans"], queryFn: () => adminListPlans() });

export const Route = createFileRoute("/_authenticated/admin/planos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQO),
  component: AdminPlansPage,
});

function AdminPlansPage() {
  const { data: plans, refetch } = useSuspenseQuery(plansQO);
  const updateFn = useServerFn(adminUpdatePlan);
  const [edits, setEdits] = useState<Record<string, { price_cents?: number; referral_points?: number; active?: boolean }>>({});

  const patch = (id: string, p: any) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  const save = async (id: string) => {
    const changes = edits[id];
    if (!changes) return;
    try {
      await updateFn({ data: { id, ...changes } });
      toast.success("Plano atualizado");
      setEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Gestão de planos</h1>

      <div className="mt-8 space-y-4">
        {plans.map((p: any) => {
          const e = edits[p.id] ?? {};
          const price = e.price_cents ?? p.price_cents;
          const points = e.referral_points ?? p.referral_points;
          const active = e.active ?? p.active;
          const dirty = Object.keys(e).length > 0;
          return (
            <div key={p.id} className="rounded-2xl border border-surface-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{p.name}</h3>
                  <p className="text-xs text-surface-900/60">{PLAN_PERIOD_LABEL[p.period]} · {p.duration_days} dias</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(ev) => patch(p.id, { active: ev.target.checked })}
                  />
                  ATIVO
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-surface-900/60">Preço (centavos)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(ev) => patch(p.id, { price_cents: Number(ev.target.value) })}
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-surface-900/50">R$ {(price / 100).toFixed(2)}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-surface-900/60">Pontos por indicação</label>
                  <input
                    type="number"
                    value={points}
                    onChange={(ev) => patch(p.id, { referral_points: Number(ev.target.value) })}
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => save(p.id)}
                    disabled={!dirty}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
