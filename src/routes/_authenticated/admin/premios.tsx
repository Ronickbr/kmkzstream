import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListRewards, adminUpsertReward, adminDeleteReward } from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const rewardsQO = queryOptions({ queryKey: ["admin", "rewards"], queryFn: () => adminListRewards() });

type Draft = {
  id?: string;
  name: string;
  description: string;
  image_url: string;
  points_cost: number;
  stock: number;
  active: boolean;
};

const empty: Draft = { name: "", description: "", image_url: "", points_cost: 100, stock: 10, active: true };

export const Route = createFileRoute("/_authenticated/admin/premios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(rewardsQO),
  component: AdminRewardsPage,
});

function AdminRewardsPage() {
  const { data: rewards, refetch } = useSuspenseQuery(rewardsQO);
  const upsertFn = useServerFn(adminUpsertReward);
  const deleteFn = useServerFn(adminDeleteReward);
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = async () => {
    if (!draft) return;
    try {
      await upsertFn({ data: draft });
      toast.success("Prêmio salvo");
      setDraft(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir prêmio?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Excluído");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <main id="main" className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Gestão de prêmios</h1>
        <button
          onClick={() => setDraft(empty)}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground"
        >
          <Plus className="size-4" /> Novo prêmio
        </button>
      </div>

      {draft && (
        <div className="mb-6 rounded-2xl border-2 border-brand bg-white p-6">
          <h3 className="mb-4 font-display text-lg font-bold">{draft.id ? "Editar prêmio" : "Novo prêmio"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="Nome"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <textarea
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="Descrição"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <input
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="URL da imagem (opcional)"
              value={draft.image_url}
              onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
            />
            <input
              type="number"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm"
              placeholder="Pontos"
              value={draft.points_cost}
              onChange={(e) => setDraft({ ...draft, points_cost: Number(e.target.value) })}
            />
            <input
              type="number"
              className="rounded-lg border border-surface-200 px-3 py-2 text-sm"
              placeholder="Estoque"
              value={draft.stock}
              onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
            />
            <label className="flex items-center gap-2 text-xs font-bold md:col-span-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              ATIVO
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
              Salvar
            </button>
            <button onClick={() => setDraft(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-bold">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {rewards.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">{r.name}</p>
                {!r.active && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">INATIVO</span>
                )}
              </div>
              <p className="text-xs text-surface-900/60">
                {r.points_cost} pts · {r.stock} em estoque
              </p>
            </div>
            <div className="flex gap-2">
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
                  })
                }
                className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold"
              >
                Editar
              </button>
              <button
                onClick={() => remove(r.id)}
                className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
