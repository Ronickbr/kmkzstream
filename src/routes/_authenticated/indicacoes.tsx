import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getMyOverview } from "@/lib/user.functions";
import { formatDateBR, formatPoints } from "@/lib/format";
import { Copy, Share2, Users, Check, Link2, Gift, Clock, CheckCircle2, TrendingUp, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";


const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/indicacoes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: IndicacoesPage,
});

function IndicacoesPage() {
  const { data } = useSuspenseQuery(overviewQO);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralCode = data.profile?.referral_code ?? "";
  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth?mode=signup&ref=${referralCode}`
      : `/auth?mode=signup&ref=${referralCode}`;



  const copy = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
      toast.success(which === "code" ? "Código copiado!" : "Link copiado!");

    } catch {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  };

  const shareMessage = `🎬 Assista TV, filmes e séries em 4K com o *KMKZ IPTV*! Use meu link e ganhe bônus de boas-vindas: ${referralLink}`;

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "KMKZ IPTV",
          text: "Streaming premium com pontos e prêmios",
          url: referralLink,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy(referralLink, "link");
    }
  };


  const confirmed = data.referrals.filter((r) => r.status === "confirmed");
  const pending = data.referrals.filter((r) => r.status !== "confirmed");
  const totalPoints = confirmed.reduce((s, r) => s + (r.points_awarded ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Suas indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compartilhe seu link e ganhe pontos quando amigos assinarem.
        </p>
      </header>

      {/* Referral card */}
      <section
        aria-labelledby="referral-heading"
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/20 via-card to-card p-5 shadow-elevate sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/20 blur-3xl"
        />
        <h2 id="referral-heading" className="sr-only">
          Seu código e link de indicação
        </h2>

        {/* Código */}
        <div>
          <label
            htmlFor="referral-code"
            className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Seu código único
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <input
              id="referral-code"
              readOnly
              value={referralCode}
              aria-label="Seu código de indicação"
              className="w-full min-w-0 rounded-2xl border border-border/60 bg-background/60 px-5 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] text-foreground sm:text-2xl"
            />
            <button
              type="button"
              onClick={() => copy(referralCode, "code")}
              aria-label={copiedCode ? "Código copiado" : "Copiar código"}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {copiedCode ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copiedCode ? "Copiado" : "Copiar código"}
            </button>
          </div>
        </div>

        {/* Link */}
        <div className="mt-6">
          <label
            htmlFor="referral-link"
            className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Link de indicação
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <div className="relative min-w-0">
              <Link2
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="referral-link"
                readOnly
                value={referralLink}
                aria-label="Seu link de indicação"
                onFocus={(e) => e.currentTarget.select()}
                className="w-full truncate rounded-xl border border-border/60 bg-background/60 py-2.5 pl-9 pr-3 text-sm text-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => copy(referralLink, "link")}
              aria-label={copiedLink ? "Link copiado" : "Copiar link"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              {copiedLink ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copiedLink ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              aria-label="Compartilhar no WhatsApp"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
            </button>
            <button
              type="button"
              onClick={share}
              aria-label="Compartilhar link"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-2 text-sm font-bold text-foreground transition hover:bg-background/60"
            >
              <Share2 className="size-4" aria-hidden="true" /> Mais
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <Gift className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
            Ganhe pontos automaticamente quando o convite virar uma assinatura.
          </p>
        </div>
      </section>

      {/* Stats */}
      {(() => {
        const total = data.referrals.length;
        const conv = total > 0 ? Math.round((confirmed.length / total) * 100) : 0;
        return (
          <>
            <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total" value={total} icon={Users} />
              <StatCard label="Confirmadas" value={confirmed.length} valueClass="text-emerald-400" icon={CheckCircle2} iconClass="text-emerald-400" />
              <StatCard label="Pendentes" value={pending.length} valueClass="text-amber-400" icon={Clock} iconClass="text-amber-400" />
              <StatCard label="Pontos ganhos" value={formatPoints(totalPoints)} valueClass="text-primary" icon={Gift} iconClass="text-primary" />
            </div>

            {total > 0 && (
              <div className="mt-6 rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                    Taxa de conversão
                  </div>
                  <span className="font-mono text-sm font-bold text-foreground">{conv}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60" role="progressbar" aria-valuenow={conv} aria-valuemin={0} aria-valuemax={100} aria-label="Taxa de conversão">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${conv}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {confirmed.length} de {total} indicações viraram assinantes.
                </p>
              </div>
            )}
          </>
        );
      })()}

      {/* Histórico */}
      <section
        aria-labelledby="history-heading"
        className="mt-6 rounded-3xl border border-border/60 bg-card p-5 sm:mt-8 sm:p-6"
      >
        <h2 id="history-heading" className="font-display text-lg font-bold text-foreground">
          Histórico
        </h2>

        {data.referrals.length === 0 ? (
          <div className="mt-6 flex flex-col items-center py-10 text-center sm:py-12">
            <Users className="size-12 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma indicação ainda. Compartilhe seu link para começar!
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="py-2 text-left">Indicado</th>
                    <th scope="col" className="py-2 text-left">Status</th>
                    <th scope="col" className="py-2 text-right">Pontos</th>
                    <th scope="col" className="py-2 text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 text-foreground">
                        {(r.referred as any)?.display_name ?? "Usuário"}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-right font-mono text-foreground">{r.points_awarded ?? 0}</td>
                      <td className="text-right text-muted-foreground">
                        {formatDateBR(r.confirmed_at ?? r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="mt-4 space-y-3 sm:hidden">
              {data.referrals.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {(r.referred as any)?.display_name ?? "Usuário"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateBR(r.confirmed_at ?? r.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Pontos:{" "}
                    <span className="font-mono font-bold text-foreground">
                      {r.points_awarded ?? 0}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {pending.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Indicações pendentes são confirmadas quando o convidado ativar uma assinatura.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = "text-foreground",
  icon: Icon,
  iconClass = "text-muted-foreground",
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClass?: string;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        {Icon && <Icon className={`size-4 ${iconClass}`} aria-hidden={true} />}
      </div>
      <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
        CONFIRMADA
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
      PENDENTE
    </span>
  );
}
