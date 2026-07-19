import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getMyOverview } from "@/lib/user.functions";
import { formatDateBR, formatPoints } from "@/lib/format";
import { Copy, Share2, Users, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/indicacoes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: IndicacoesPage,
});

function IndicacoesPage() {
  const { data } = useSuspenseQuery(overviewQO);
  const [copied, setCopied] = useState(false);

  const referralCode = data.profile?.referral_code ?? "";
  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/auth?mode=signup&ref=${referralCode}`
    : `/auth?mode=signup&ref=${referralCode}`;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Junte-se ao Nexus",
        text: "Assine o Nexus e ganhe recompensas!",
        url: referralLink,
      });
    } else {
      copy(referralLink);
    }
  };

  const confirmed = data.referrals.filter((r) => r.status === "confirmed");
  const pending = data.referrals.filter((r) => r.status !== "confirmed");
  const totalPoints = confirmed.reduce((s, r) => s + (r.points_awarded ?? 0), 0);

  return (
    <div className="min-h-dvh bg-surface-50">
      <div role="main" id="main" className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">Suas indicações</h1>
          <p className="mt-1 text-sm text-surface-900/60">
            Compartilhe seu link e ganhe pontos quando amigos assinarem.
          </p>
        </header>

        <div className="rounded-3xl bg-gradient-to-br from-surface-900 to-surface-900/90 p-8 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Seu código único</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="rounded-2xl bg-card/10 px-6 py-3 font-mono text-2xl font-bold tracking-widest">
              {referralCode}
            </div>
            <button
              onClick={() => copy(referralCode)}
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold text-surface-900 hover:bg-card/90"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copiar código
            </button>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">Link de indicação</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={referralLink}
                className="flex-1 rounded-xl bg-card/10 px-4 py-2.5 text-sm text-white"
              />
              <button
                onClick={() => copy(referralLink)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold hover:bg-brand-dark"
              >
                <Copy className="size-4" /> Copiar link
              </button>
              <button
                onClick={share}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-card/10"
              >
                <Share2 className="size-4" /> Compartilhar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-surface-200 bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-surface-900/60">Total</p>
            <p className="mt-2 text-3xl font-bold">{data.referrals.length}</p>
          </div>
          <div className="rounded-3xl border border-surface-200 bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-surface-900/60">Confirmadas</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{confirmed.length}</p>
          </div>
          <div className="rounded-3xl border border-surface-200 bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-surface-900/60">Pontos ganhos</p>
            <p className="mt-2 text-3xl font-bold text-brand">{formatPoints(totalPoints)}</p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-surface-200 bg-card p-6">
          <h2 className="font-display text-lg font-bold">Histórico</h2>
          {data.referrals.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-12 text-center">
              <Users className="size-12 text-surface-900/20" />
              <p className="mt-3 text-sm text-surface-900/60">
                Nenhuma indicação ainda. Compartilhe seu link para começar!
              </p>
            </div>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-xs font-bold uppercase tracking-wider text-surface-900/40">
                  <th className="py-2 text-left">Indicado</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Pontos</th>
                  <th className="py-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0">
                    <td className="py-3">{(r.referred as any)?.display_name ?? "Usuário"}</td>
                    <td>
                      {r.status === "confirmed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          CONFIRMADA
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          PENDENTE
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono">{r.points_awarded ?? 0}</td>
                    <td className="text-right text-surface-900/60">{formatDateBR(r.confirmed_at ?? r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {pending.length > 0 && (
            <p className="mt-4 text-xs text-surface-900/50">
              Indicações pendentes são confirmadas quando o convidado ativar uma assinatura.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
