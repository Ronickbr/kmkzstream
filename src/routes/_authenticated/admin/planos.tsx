import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPlans, adminUpdatePlan } from "@/lib/admin.functions";
import { PLAN_PERIOD_LABEL } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Save, Sparkles, TvMinimal, Users2 } from "lucide-react";

const plansQO = queryOptions({ queryKey: ["admin", "plans"], queryFn: () => adminListPlans() });

export const Route = createFileRoute("/_authenticated/admin/planos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQO),
  component: AdminPlansPage,
});

type PlanEdit = {
  name?: string;
  price_cents?: number;
  purchase_points?: number;
  referral_points?: number;
  
  screen_limit?: number;
  quality?: string;
  is_popular?: boolean;
  active?: boolean;
};

function AdminPlansPage() {
  const { data: plans, refetch } = useSuspenseQuery(plansQO);
  const updateFn = useServerFn(adminUpdatePlan);
  const [edits, setEdits] = useState<Record<string, PlanEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const patch = (id: string, p: PlanEdit) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  const save = async (id: string) => {
    const changes = edits[id];
    if (!changes) return;
    setSavingId(id);
    try {
      await updateFn({ data: { id, ...changes } });
      toast.success("Plano atualizado");
      setEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-black tracking-tight">
          <Crown className="size-7 text-brand" aria-hidden="true" /> Gestão de planos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste preços, pontos e recursos oferecidos por cada plano.
        </p>
      </header>

      <div className="grid gap-4">
        {plans.map((p: any) => {
          const e = edits[p.id] ?? {};
          const name = e.name ?? p.name;
          const price = e.price_cents ?? p.price_cents;
          const purchase = e.purchase_points ?? p.purchase_points ?? 0;
          const referral = e.referral_points ?? p.referral_points ?? 0;
          
          const screens = e.screen_limit ?? p.screen_limit ?? 1;
          const quality = e.quality ?? p.quality ?? "HD";
          const popular = e.is_popular ?? p.is_popular ?? false;
          const active = e.active ?? p.active;
          const dirty = Object.keys(e).length > 0;
          const priceReais = (price / 100).toFixed(2).replace(".", ",");

          return (
            <article
              key={p.id}
              className={`card-surface p-5 transition ${
                popular ? "ring-1 ring-brand/50" : ""
              } ${!active ? "opacity-70" : ""}`}
            >
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{name}</h3>
                    {popular && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                        <Sparkles className="size-3" /> Popular
                      </span>
                    )}
                    {!active && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PLAN_PERIOD_LABEL[p.period]} · {p.duration_days} dias
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-black text-brand">R$ {priceReais}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">preço final</p>
                </div>
              </header>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nome do plano">
                  <input
                    value={name}
                    onChange={(ev) => patch(p.id, { name: ev.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Preço (R$)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={(price / 100).toFixed(2)}
                    onChange={(ev) =>
                      patch(p.id, { price_cents: Math.round(Number(ev.target.value) * 100) })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Qualidade">
                  <select
                    value={quality}
                    onChange={(ev) => patch(p.id, { quality: ev.target.value })}
                    className={inputCls}
                  >
                    <option value="SD">SD</option>
                    <option value="HD">HD</option>
                    <option value="Full HD">Full HD</option>
                    <option value="4K">4K</option>
                  </select>
                </Field>
                <Field label="Telas simultâneas" icon={<TvMinimal className="size-3.5" />}>
                  <input
                    type="number"
                    min={1}
                    value={screens}
                    onChange={(ev) => patch(p.id, { screen_limit: Number(ev.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Pontos por aquisição">
                  <input
                    type="number"
                    min={0}
                    value={purchase}
                    onChange={(ev) => patch(p.id, { purchase_points: Number(ev.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Pontos por indicação" icon={<Users2 className="size-3.5" />}>
                  <input
                    type="number"
                    min={0}
                    value={referral}
                    onChange={(ev) => patch(p.id, { referral_points: Number(ev.target.value) })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap gap-4">
                  <Toggle
                    checked={active}
                    onChange={(v) => patch(p.id, { active: v })}
                    label="Ativo"
                  />
                  <Toggle
                    checked={popular}
                    onChange={(v) => patch(p.id, { is_popular: v })}
                    label="Destacar como popular"
                  />
                </div>
                <button
                  onClick={() => save(p.id)}
                  disabled={!dirty || savingId === p.id}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  <Save className="size-4" /> {savingId === p.id ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}
