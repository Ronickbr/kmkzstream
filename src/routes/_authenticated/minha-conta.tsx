import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { getMyOverview, updateMyProfile } from "@/lib/user.functions";
import { useState } from "react";
import { toast } from "sonner";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/minha-conta")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const { data, refetch } = useSuspenseQuery(overviewQO);
  const updateFn = useServerFn(updateMyProfile);
  const [name, setName] = useState(data.profile?.display_name ?? "");
  const [avatar, setAvatar] = useState(data.profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFn({ data: { display_name: name, avatar_url: avatar || null } });
      toast.success("Perfil atualizado");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface-50">
      <AppNav isAdmin={data.isAdmin} />
      <div role="main" id="main" className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold">Minha conta</h1>
        <form onSubmit={handleSave} className="mt-8 space-y-5 rounded-3xl border border-surface-200 bg-white p-8">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-surface-900/60">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus:border-brand focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-surface-900/60">URL do avatar (opcional)</label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus:border-brand focus:outline-none"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-surface-900/60">Código de indicação</label>
            <div className="rounded-xl bg-surface-100 px-4 py-2.5 font-mono text-sm">
              {data.profile?.referral_code}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>
      </div>
    </div>
  );
}
