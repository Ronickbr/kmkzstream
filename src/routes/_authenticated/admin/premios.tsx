import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListRewards, adminUpsertReward, adminDeleteReward } from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Package, Plus, Trash2, Tv, ImageIcon, Save, X } from "lucide-react";

const rewardsQO = queryOptions({ queryKey: ["admin", "rewards"], queryFn: () => adminListRewards() });

type Draft = {
  id?: string;
  name: string;
  description: string;
  image_url: string;
  points_cost: number;
  stock: number;
  active: boolean;
  kind: "subscription" | "device";
  subscription_months: number | null;
};

const empty: Draft = {
  name: "",
  description: "",
  image_url: "",
  points_cost: 100,
  stock: 10,
  active: true,
  kind: "subscription",
  subscription_months: 1,
};

export const Route = createFileRoute("/_authenticated/admin/premios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(rewardsQO),
  component: AdminRewardsPage,
});

function AdminRewardsPage() {
  const { data: rewards, refetch } = useSuspenseQuery(rewardsQO);
  const upsertFn = useServerFn(adminUpsertReward);
  const deleteFn = useServerFn(adminDeleteReward);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Informe o nome do prêmio");
    setSaving(true);
    try {
      await upsertFn({
        data: {
          ...draft,
          subscription_months:
            draft.kind === "subscription" ? draft.subscription_months ?? 1 : null,
        },
      });
      toast.success("Prêmio salvo");
      setDraft(null);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este prêmio?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Excluído");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-black tracking-tight">
            <Gift className="size-7 text-brand" aria-hidden="true" /> Gestão de prêmios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre assinaturas de bônus e dispositivos que podem ser resgatados com pontos.
          </p>
        </div>
        <button
          onClick={() => setDraft(empty)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> Novo prêmio
        </button>
      </header>

      {draft && (
        <section className="mb-6 rounded-2xl border border-brand/40 bg-card p-5 shadow-lg">
          <header className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold">
              {draft.id ? "Editar prêmio" : "Novo prêmio"}
            </h3>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/60">
                {draft.image_url ? (
                  <img
                    src={draft.image_url}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <ImageIcon className="size-10 text-muted-foreground/40" />
                )}
              </div>
              <input
                className={inputCls + " mt-2"}
                placeholder="URL da imagem"
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({ ...draft, kind: e.target.value as Draft["kind"] })
                  }
                  className={inputCls}
                >
                  <option value="subscription">Assinatura de bônus</option>
                  <option value="device">Dispositivo físico</option>
                </select>
              </Field>

              {draft.kind === "subscription" ? (
                <Field label="Meses de assinatura">
                  <input
                    type="number"
                    min={1}
                    value={draft.subscription_months ?? 1}
                    onChange={(e) =>
                      setDraft({ ...draft, subscription_months: Number(e.target.value) || 1 })
                    }
                    className={inputCls}
                  />
                </Field>
              ) : (
                <div />
              )}

              <Field label="Nome" wide>
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex.: Mi TV Stick 4K"
                />
              </Field>

              <Field label="Descrição" wide>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>

              <Field label="Pontos para resgate">
                <input
                  type="number"
                  min={0}
                  value={draft.points_cost}
                  onChange={(e) =>
                    setDraft({ ...draft, points_cost: Number(e.target.value) || 0 })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Estoque">
                <input
                  type="number"
                  min={0}
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="size-4 accent-primary"
                />
                Ativo (visível para usuários)
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-border/60 pt-4">
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-border/60 px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Save className="size-4" /> {saving ? "Salvando..." : "Salvar prêmio"}
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            Nenhum prêmio cadastrado ainda.
          </div>
        )}
        {rewards.map((r: any) => (
          <article
            key={r.id}
            className={`card-surface flex flex-col overflow-hidden ${
              !r.active ? "opacity-70" : ""
            }`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
              {r.image_url ? (
                <img src={r.image_url} alt={r.name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/40">
                  {r.kind === "device" ? <Package className="size-10" /> : <Tv className="size-10" />}
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
                {r.kind === "device" ? "Dispositivo" : `${r.subscription_months ?? 1} mês(es)`}
              </span>
              {!r.active && (
                <span className="absolute right-2 top-2 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
                  Inativo
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h4 className="font-bold">{r.name}</h4>
              {r.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="rounded-full bg-brand/15 px-2 py-1 font-bold text-brand">
                  {r.points_cost} pts
                </span>
                <span className="text-muted-foreground">
                  Estoque: <b className="text-foreground">{r.stock}</b>
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    setDraft({
                      id: r.id,
                      name: r.name,
                      description: r.description ?? "",
                      image_url: r.image_url ?? "",
                      points_cost: r.points_cost,
                      stock: r.stock,
                      active: r.active,
                      kind: (r.kind as any) ?? "subscription",
                      subscription_months: r.subscription_months ?? 1,
                    })
                  }
                  className="flex-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold hover:border-brand hover:text-brand"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(r.id)}
                  aria-label="Excluir prêmio"
                  className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "w-full min-w-0 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
