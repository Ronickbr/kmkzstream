import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListAuditLogs } from "@/lib/admin.functions";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AdminAuditPage,
  head: () => ({
    meta: [
      { title: "Auditoria | KMKZ IPTV" },
      { name: "description", content: "Trilha de auditoria de ações sensíveis da plataforma KMKZ IPTV." },
      { property: "og:title", content: "Auditoria | KMKZ IPTV" },
      { property: "og:description", content: "Trilha de auditoria de ações sensíveis da plataforma KMKZ IPTV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ENTITIES = [
  { value: "", label: "Todas as áreas" },
  { value: "subscriptions", label: "Assinaturas" },
  { value: "point_events", label: "Pontos" },
  { value: "user_roles", label: "Papéis/Admin" },
  { value: "reward_redemptions", label: "Resgates" },
  { value: "profiles", label: "Perfis" },
  { value: "app_settings", label: "Configurações" },
];

function AdminAuditPage() {
  const listFn = useServerFn(adminListAuditLogs);
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", entity, search],
    queryFn: () => listFn({ data: { entity: entity || undefined, search: search || undefined, limit: 200 } }),
  });

  const rows = (data ?? []) as any[];

  return (
    <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold">Auditoria</h1>
      <p className="mt-1 text-sm text-surface-900/60">
        Trilha de ações sensíveis com autor, alvo e data/hora.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <select
          aria-label="Filtrar por área"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="rounded-xl border border-surface-200 bg-card px-3 py-2 text-sm"
        >
          {ENTITIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Buscar na auditoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuário, ação ou ID…"
          className="flex-1 rounded-xl border border-surface-200 bg-card px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-surface-200 bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-50 text-xs font-bold uppercase tracking-wider text-surface-900/60">
            <tr>
              <th className="px-4 py-3 text-left">Data/hora</th>
              <th className="px-4 py-3 text-left">Autor</th>
              <th className="px-4 py-3 text-left">Ação</th>
              <th className="px-4 py-3 text-left">Área</th>
              <th className="px-4 py-3 text-left">Alvo</th>
              <th className="px-4 py-3 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-900/60">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-900/60">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <>
                <tr key={r.id} className="border-t border-surface-100">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {formatDateBR(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {r.actor_name}
                    {r.actor_is_admin && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3">{r.entity}</td>
                  <td className="px-4 py-3">{r.target_name ?? r.entity_id ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                      className="rounded-lg border border-surface-200 px-3 py-1 text-xs font-semibold hover:bg-surface-50"
                    >
                      {openId === r.id ? "Fechar" : "Ver"}
                    </button>
                  </td>
                </tr>
                {openId === r.id && (
                  <tr key={`${r.id}-d`} className="border-t border-surface-100 bg-surface-50/60">
                    <td colSpan={6} className="px-4 py-3">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                        {JSON.stringify({ old: r.old_data, new: r.new_data, metadata: r.metadata }, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
