import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListRedemptions, adminUpdateRedemption } from "@/lib/admin.functions";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const redQO = queryOptions({ queryKey: ["admin", "redemptions"], queryFn: () => adminListRedemptions() });

export const Route = createFileRoute("/_authenticated/admin/resgates")({
  loader: ({ context }) => context.queryClient.ensureQueryData(redQO),
  component: AdminRedemptionsPage,
});

function AdminRedemptionsPage() {
  const { data: items, refetch } = useSuspenseQuery(redQO);
  const updateFn = useServerFn(adminUpdateRedemption);

  const update = async (id: string, status: "pending" | "delivered" | "canceled") => {
    try {
      await updateFn({ data: { id, status } });
      toast.success("Status atualizado");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Resgates</h1>
      <div className="mt-8 overflow-x-auto rounded-3xl border border-surface-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-xs font-bold uppercase tracking-wider text-surface-900/60">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Prêmio</th>
              <th className="px-4 py-3 text-right">Pontos</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r: any) => (
              <tr key={r.id} className="border-t border-surface-100">
                <td className="px-4 py-3">{(r.user as any)?.display_name ?? "—"}</td>
                <td className="px-4 py-3">{(r.reward as any)?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{r.points_spent}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === "delivered"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.status === "canceled"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-surface-900/60">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === "pending" && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => update(r.id, "delivered")}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"
                      >
                        Entregar
                      </button>
                      <button
                        onClick={() => update(r.id, "canceled")}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
