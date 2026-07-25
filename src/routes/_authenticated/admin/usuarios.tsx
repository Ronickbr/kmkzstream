import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, Pencil, Shield, ShieldOff, Trash2, X } from "lucide-react";
import {
  adminListUsers,
  adminSetUserRole,
  adminGetUser,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/admin.functions";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";

const usersQO = queryOptions({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQO),
  component: AdminUsersPage,
});

type Mode = "view" | "edit" | null;

function AdminUsersPage() {
  const { data: users, refetch } = useSuspenseQuery(usersQO);
  const setRoleFn = useServerFn(adminSetUserRole);
  const deleteFn = useServerFn(adminDeleteUser);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const filtered = users.filter((u: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.referral_code ?? "").toLowerCase().includes(q)
    );
  });

  const filteredIds = filtered.map((u: any) => u.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected =
    filteredIds.some((id) => selectedIds.has(id)) && !allFilteredSelected;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedUsers = users.filter((u: any) => selectedIds.has(u.id));
  const selectedAdminsCount = selectedUsers.filter((u: any) =>
    (u.roles as string[]).includes("admin"),
  ).length;

  const toggle = async (userId: string, isAdmin: boolean) => {
    try {
      await setRoleFn({ data: { userId, makeAdmin: !isAdmin } });
      toast.success(isAdmin ? "Admin removido" : "Admin concedido");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    const ok = await confirmAction(
      `Excluir ${name}? Esta ação é irreversível.`,
      { confirmLabel: "Excluir", danger: true },
    );
    if (!ok) return;
    try {
      await deleteFn({ data: { userId } });
      toast.success("Usuário excluído");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir");
    }
  };

  const runBulk = async (
    label: string,
    action: (u: any) => Promise<unknown>,
    successMsg: (ok: number, fail: number) => string,
  ) => {
    setBulkRunning(true);
    let ok = 0;
    let fail = 0;
    for (const u of selectedUsers) {
      try {
        await action(u);
        ok += 1;
      } catch (e: any) {
        fail += 1;
        console.error(`[bulk ${label}]`, u.id, e);
      }
    }
    setBulkRunning(false);
    clearSelection();
    refetch();
    if (fail === 0) toast.success(successMsg(ok, fail));
    else toast.error(successMsg(ok, fail));
  };

  const bulkDelete = async () => {
    const names = selectedUsers.slice(0, 3).map((u: any) => u.display_name ?? "usuário").join(", ");
    const extra = selectedUsers.length > 3 ? ` e mais ${selectedUsers.length - 3}` : "";
    const ok = await confirmAction(
      `Excluir ${selectedUsers.length} usuário(s): ${names}${extra}? Ação irreversível.`,
      { confirmLabel: `Excluir ${selectedUsers.length}`, danger: true },
    );
    if (!ok) return;
    await runBulk(
      "delete",
      (u) => deleteFn({ data: { userId: u.id } }),
      (ok, fail) =>
        fail === 0
          ? `${ok} usuário(s) excluído(s)`
          : `${ok} excluído(s), ${fail} falha(s)`,
    );
  };

  const bulkPromote = async () => {
    const toPromote = selectedUsers.filter(
      (u: any) => !(u.roles as string[]).includes("admin"),
    );
    if (toPromote.length === 0) {
      toast.info("Todos os selecionados já são admin");
      return;
    }
    const ok = await confirmAction(
      `Conceder admin para ${toPromote.length} usuário(s)?`,
      { confirmLabel: "Conceder" },
    );
    if (!ok) return;
    setBulkRunning(true);
    let done = 0;
    let fail = 0;
    for (const u of toPromote) {
      try {
        await setRoleFn({ data: { userId: u.id, makeAdmin: true } });
        done += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkRunning(false);
    clearSelection();
    refetch();
    if (fail === 0) toast.success(`${done} usuário(s) promovido(s)`);
    else toast.error(`${done} promovido(s), ${fail} falha(s)`);
  };

  const bulkDemote = async () => {
    const toDemote = selectedUsers.filter((u: any) =>
      (u.roles as string[]).includes("admin"),
    );
    if (toDemote.length === 0) {
      toast.info("Nenhum admin selecionado");
      return;
    }
    const ok = await confirmAction(
      `Remover admin de ${toDemote.length} usuário(s)?`,
      { confirmLabel: "Remover", danger: true },
    );
    if (!ok) return;
    setBulkRunning(true);
    let done = 0;
    let fail = 0;
    for (const u of toDemote) {
      try {
        await setRoleFn({ data: { userId: u.id, makeAdmin: false } });
        done += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkRunning(false);
    clearSelection();
    refetch();
    if (fail === 0) toast.success(`${done} admin(s) removido(s)`);
    else toast.error(`${done} removido(s), ${fail} falha(s)`);
  };

  const open = (id: string, m: Mode) => {
    setSelectedId(id);
    setMode(m);
  };
  const close = () => {
    setSelectedId(null);
    setMode(null);
  };


  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Usuários</h1>
          <p className="text-sm text-surface-900/60">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <input
          type="search"
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-surface-200 bg-card px-4 py-2 text-sm focus:border-brand focus:outline-none sm:w-72"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3">
          <div className="text-sm">
            <span className="font-bold text-brand">{selectedIds.size}</span>{" "}
            selecionado(s) · {selectedAdminsCount} admin(s) ·{" "}
            {selectedIds.size - selectedAdminsCount} usuário(s) comum
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={clearSelection}
              disabled={bulkRunning}
              className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold hover:bg-surface-50 disabled:opacity-50"
            >
              Limpar
            </button>
            <button
              onClick={bulkPromote}
              disabled={bulkRunning}
              className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold hover:bg-surface-50 disabled:opacity-50"
            >
              <Shield size={14} /> Tornar admin
            </button>
            <button
              onClick={bulkDemote}
              disabled={bulkRunning}
              className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold hover:bg-surface-50 disabled:opacity-50"
            >
              <ShieldOff size={14} /> Remover admin
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkRunning}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-surface-200 bg-card">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-surface-50 text-xs font-bold uppercase tracking-wider text-surface-900/60">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected;
                  }}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
              </th>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-right">Indicações</th>
              <th className="px-4 py-3 text-right">Pontos</th>
              <th className="px-4 py-3 text-left">Criado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => {
              const isAdmin = (u.roles as string[]).includes("admin");
              const checked = selectedIds.has(u.id);
              return (
                <tr key={u.id} className={`border-t border-surface-100 ${checked ? "bg-brand/5" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${u.display_name ?? "usuário"}`}
                      checked={checked}
                      onChange={() => toggleOne(u.id)}
                      className="h-4 w-4 cursor-pointer accent-brand"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{u.display_name}</p>
                        <p className="font-mono text-[10px] text-surface-900/40">{u.referral_code}</p>
                      </div>
                      {isAdmin && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                          ADMIN
                        </span>
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => open(u.id, "view")}
                        className="rounded-lg border border-surface-200 p-1.5 text-surface-900/70 hover:bg-surface-50 hover:text-surface-900"
                        aria-label="Ver detalhes"
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => open(u.id, "edit")}
                        className="rounded-lg border border-surface-200 p-1.5 text-surface-900/70 hover:bg-surface-50 hover:text-surface-900"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggle(u.id, isAdmin)}
                        className="rounded-lg border border-surface-200 p-1.5 text-surface-900/70 hover:bg-surface-50 hover:text-surface-900"
                        aria-label={isAdmin ? "Remover admin" : "Tornar admin"}
                        title={isAdmin ? "Remover admin" : "Tornar admin"}
                      >
                        {isAdmin ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.display_name ?? "usuário")}
                        className="rounded-lg border border-red-500/30 p-1.5 text-red-500 hover:bg-red-500/10"
                        aria-label="Excluir"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-surface-900/50">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && mode && (
        <UserModal
          userId={selectedId}
          mode={mode}
          onClose={close}
          onSaved={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

function UserModal({
  userId,
  mode,
  onClose,
  onSaved,
}: {
  userId: string;
  mode: "view" | "edit";
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(adminUpdateUser);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => adminGetUser({ data: { userId } }),
  });

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  const current = form ?? {
    display_name: data?.profile?.display_name ?? "",
    whatsapp: data?.profile?.whatsapp ?? "",
    phone: data?.profile?.phone ?? "",
    city: data?.profile?.city ?? "",
    state: data?.profile?.state ?? "",
    bio: data?.profile?.bio ?? "",
    total_points: data?.total_points ?? 0,
  };

  const set = (k: string, v: any) => setForm({ ...current, [k]: v });

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          userId,
          display_name: current.display_name?.trim() || undefined,
          whatsapp: current.whatsapp || null,
          phone: current.phone || null,
          city: current.city || null,
          state: current.state || null,
          bio: current.bio || null,
          total_points: Number(current.total_points) || 0,
        },
      });
      toast.success("Usuário atualizado");
      await refetch();
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-surface-200 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4">
          <h2 className="font-display text-xl font-bold">
            {mode === "view" ? "Detalhes do usuário" : "Editar usuário"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-900/60 hover:bg-surface-100"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {isLoading || !data ? (
            <p className="text-sm text-surface-900/60">Carregando...</p>
          ) : mode === "view" ? (
            <div className="space-y-4 text-sm">
              <Section title="Perfil">
                <Row label="Nome" value={data.profile.display_name} />
                <Row label="E-mail" value={data.email} />
                <Row label="Código" value={data.profile.referral_code} mono />
                <Row label="WhatsApp" value={data.profile.whatsapp} />
                <Row label="Telefone" value={data.profile.phone} />
                <Row label="Cidade/UF" value={[data.profile.city, data.profile.state].filter(Boolean).join(" / ")} />
                <Row label="CPF" value={data.profile.cpf} mono />
                <Row label="Bio" value={data.profile.bio} />
                <Row label="Cadastro" value={formatDateBR(data.profile.created_at)} />
                <Row label="Último login" value={data.last_sign_in_at ? formatDateBR(data.last_sign_in_at) : "—"} />
                <Row label="Papéis" value={data.roles.join(", ") || "user"} />
                <Row label="Pontos" value={String(data.total_points)} />
              </Section>

              <Section title={`Assinaturas (${data.subscriptions.length})`}>
                {data.subscriptions.length === 0 ? (
                  <p className="text-surface-900/50">Nenhuma assinatura.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.subscriptions.map((s: any) => (
                      <li key={s.id} className="flex justify-between border-b border-surface-100 py-1">
                        <span>
                          {s.plan?.name ?? "—"} <span className="text-surface-900/50">({s.status})</span>
                        </span>
                        <span className="text-surface-900/60">
                          {formatDateBR(s.starts_at)} → {s.ends_at ? formatDateBR(s.ends_at) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={`Indicações (${data.referrals.length})`}>
                {data.referrals.length === 0 ? (
                  <p className="text-surface-900/50">Nenhuma indicação.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.referrals.map((r: any) => (
                      <li key={r.id} className="flex justify-between border-b border-surface-100 py-1">
                        <span>{r.status}</span>
                        <span className="text-surface-900/60">
                          {formatDateBR(r.created_at)} · {r.points_awarded ?? 0} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={`Resgates (${data.redemptions.length})`}>
                {data.redemptions.length === 0 ? (
                  <p className="text-surface-900/50">Nenhum resgate.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.redemptions.map((r: any) => (
                      <li key={r.id} className="flex justify-between border-b border-surface-100 py-1">
                        <span>
                          {r.reward?.name ?? "—"} <span className="text-surface-900/50">({r.status})</span>
                        </span>
                        <span className="text-surface-900/60">
                          {formatDateBR(r.created_at)} · {r.points_spent} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome" value={current.display_name} onChange={(v) => set("display_name", v)} />
              <Field label="WhatsApp" value={current.whatsapp ?? ""} onChange={(v) => set("whatsapp", v)} />
              <Field label="Telefone" value={current.phone ?? ""} onChange={(v) => set("phone", v)} />
              <Field label="Cidade" value={current.city ?? ""} onChange={(v) => set("city", v)} />
              <Field label="UF" value={current.state ?? ""} onChange={(v) => set("state", v)} />
              <Field
                label="Pontos totais"
                type="number"
                value={String(current.total_points ?? 0)}
                onChange={(v) => set("total_points", v)}
              />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-surface-900/60">Bio</label>
                <textarea
                  value={current.bio ?? ""}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-surface-200 bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-semibold hover:bg-surface-50"
          >
            {mode === "view" ? "Fechar" : "Cancelar"}
          </button>
          {mode === "edit" && (
            <button
              onClick={save}
              disabled={saving || isLoading}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-surface-900/60">{title}</h3>
      <div className="rounded-xl border border-surface-100 bg-surface-50/50 p-3">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-surface-100 py-1 last:border-b-0">
      <span className="text-surface-900/60">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value || <span className="text-surface-900/40">—</span>}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-surface-900/60">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-surface-200 bg-card px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
    </div>
  );
}
