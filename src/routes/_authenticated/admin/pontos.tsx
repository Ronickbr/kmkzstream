import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListPointRules,
  adminUpsertPointRule,
  adminDeletePointRule,
  type PointRule,
} from "@/lib/admin.functions";
import { Sparkles, Plus, Save, Trash2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const rulesQO = queryOptions({ queryKey: ["admin", "point-rules"], queryFn: () => adminListPointRules() });

export const Route = createFileRoute("/_authenticated/admin/pontos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(rulesQO),
  component: PointRulesPage,
});

const RESERVED = new Set(["share", "referral_confirmed", "reward_redeemed"]);

type Draft = { id: string; name: string; points: number; daily_limit: number | null; active: boolean; isNew?: boolean };

function toDraft(r: PointRule): Draft {
  return { id: r.id, name: r.name, points: r.points, daily_limit: r.daily_limit, active: r.active };
}

function PointRulesPage() {
  const { data } = useSuspenseQuery(rulesQO);
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertPointRule);
  const remove = useServerFn(adminDeletePointRule);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(data.map((r) => [r.id, toDraft(r)]))
  );
  const [newRule, setNewRule] = useState<Draft | null>(null);

  const refresh = async () => {
    const res = await qc.fetchQuery(rulesQO);
    setDrafts(Object.fromEntries(res.map((r) => [r.id, toDraft(r)])));
  };

  const save = async (d: Draft) => {
    try {
      await upsert({ data: { id: d.id, name: d.name, points: d.points, daily_limit: d.daily_limit, active: d.active } });
      toast.success("Regra salva");
      setNewRule(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Regra removida");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  return (
    <div role="main" id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-black tracking-tight">
            <Sparkles className="size-7 text-brand" aria-hidden="true" /> Regras de Pontos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste quantos pontos cada ação concede e defina limites diários.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setNewRule({ id: "", name: "", points: 1, daily_limit: null, active: true, isNew: true })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" /> Nova regra
        </button>
      </header>

      <div className="space-y-3">
        {newRule && (
          <RuleCard
            draft={newRule}
            onChange={(p) => setNewRule({ ...newRule, ...p })}
            onSave={() => save(newRule)}
            onCancel={() => setNewRule(null)}
            isNew
          />
        )}

        {data.map((r) => {
          const d = drafts[r.id] ?? toDraft(r);
          const reserved = RESERVED.has(r.id);
          const dirty =
            d.name !== r.name ||
            d.points !== r.points ||
            d.daily_limit !== r.daily_limit ||
            d.active !== r.active;
          return (
            <RuleCard
              key={r.id}
              draft={d}
              reserved={reserved}
              dirty={dirty}
              onChange={(p) => update(r.id, p)}
              onSave={() => save(d)}
              onDelete={reserved ? undefined : () => del(r.id)}
            />
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Regras do sistema</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><code className="text-foreground">daily_login</code> — bônus ao clicar em resgatar no painel.</li>
          <li><code className="text-foreground">share</code> — concedido ao compartilhar/copiar o link.</li>
          <li><code className="text-foreground">referral_confirmed</code> — usa <em>referral_points</em> do plano.</li>
          <li><code className="text-foreground">reward_redeemed</code> — registro de resgate (negativo).</li>
        </ul>
        <p className="mt-3">
          Você pode criar regras extras (ex.: <code>signup_bonus</code>) para registro manual em campanhas — elas
          aparecerão no histórico do usuário quando eventos forem lançados.
        </p>
      </section>
    </div>
  );
}

function RuleCard({
  draft,
  reserved,
  dirty,
  isNew,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: Draft;
  reserved?: boolean;
  dirty?: boolean;
  isNew?: boolean;
  onChange: (p: Partial<Draft>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="card-surface p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_100px_120px_100px_auto] md:items-end">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          ID
          <div className="mt-1 flex items-center gap-1">
            <input
              value={draft.id}
              disabled={!isNew}
              onChange={(e) => onChange({ id: e.target.value.toLowerCase() })}
              placeholder="ex.: signup_bonus"
              className="w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-sm text-foreground normal-case disabled:opacity-70"
            />
            {reserved && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Reservado" />}
          </div>
        </label>

        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Nome
          <input
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-1 w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground normal-case"
          />
        </label>

        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Pontos
          <input
            type="number"
            min={0}
            value={draft.points}
            onChange={(e) => onChange({ points: Number(e.target.value) || 0 })}
            className="mt-1 w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-right font-mono text-sm text-foreground"
          />
        </label>

        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Limite/dia
          <input
            type="number"
            min={0}
            value={draft.daily_limit ?? ""}
            placeholder="∞"
            onChange={(e) =>
              onChange({ daily_limit: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="mt-1 w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-right font-mono text-sm text-foreground"
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => onChange({ active: e.target.checked })}
            className="size-4 accent-primary"
          />
          Ativa
        </label>

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border/60 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!isNew && !dirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Save className="size-3.5" aria-hidden="true" /> Salvar
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Remover regra"
              className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:border-destructive/60 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
