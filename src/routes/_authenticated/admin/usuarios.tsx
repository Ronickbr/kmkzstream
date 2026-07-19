import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminSetUserRole } from "@/lib/admin.functions";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";

const usersQO = queryOptions({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQO),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { data: users, refetch } = useSuspenseQuery(usersQO);
  const setRoleFn = useServerFn(adminSetUserRole);

  const toggle = async (userId: string, isAdmin: boolean) => {
    try {
      await setRoleFn({ data: { userId, makeAdmin: !isAdmin } });
      toast.success(isAdmin ? "Admin removido" : "Admin concedido");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold">Usuários</h1>
      <div className="mt-8 overflow-x-auto rounded-3xl border border-surface-200 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-xs font-bold uppercase tracking-wider text-surface-900/60">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-right">Indicações</th>
              <th className="px-4 py-3 text-right">Pontos</th>
              <th className="px-4 py-3 text-left">Criado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => {
              const isAdmin = (u.roles as string[]).includes("admin");
              return (
                <tr key={u.id} className="border-t border-surface-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{u.display_name}</p>
                        <p className="font-mono text-[10px] text-surface-900/40">{u.referral_code}</p>
                      </div>
                      {isAdmin && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">ADMIN</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.active_plan ?? <span className="text-surface-900/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {u.referrals_confirmed}/{u.referrals_total}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-brand">{u.points}</td>
                  <td className="px-4 py-3 text-surface-900/60">{formatDateBR(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(u.id, isAdmin)}
                      className="rounded-lg border border-surface-200 px-3 py-1 text-xs font-bold hover:bg-surface-50"
                    >
                      {isAdmin ? "Remover admin" : "Tornar admin"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
