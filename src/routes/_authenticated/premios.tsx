import { confirmAction } from "@/lib/confirm";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveRewards } from "@/lib/plans.functions";
import { redeemReward, type ShippingInput } from "@/lib/redemptions.functions";
import { overviewQueryOptions as overviewQO, rewardsQueryOptions as rewardsQO } from "@/lib/queries";
import { formatPoints, formatDateBR } from "@/lib/format";
import { Gift, Sparkles, Package, CalendarPlus, Truck, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/premios")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(overviewQO),
      context.queryClient.ensureQueryData(rewardsQO),
    ]),
  component: PremiosPage,
});

type Reward = Awaited<ReturnType<typeof listActiveRewards>>[number];

const emptyShipping: ShippingInput = {
  recipient: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  notes: "",
};

function PremiosPage() {
  const { data: overview, refetch: refetchOverview } = useSuspenseQuery(overviewQO);
  const { data: rewards, refetch: refetchRewards } = useSuspenseQuery(rewardsQO);
  const redeemFn = useServerFn(redeemReward);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Reward | null>(null);
  const [shipping, setShipping] = useState<ShippingInput>(emptyShipping);

  const runRedeem = async (rewardId: string, ship?: ShippingInput) => {
    setBusy(rewardId);
    try {
      await redeemFn({ data: { rewardId, shipping: ship } });
      toast.success(
        ship ? "Resgate confirmado! Enviaremos por e-mail o rastreio quando despachado." : "Resgate confirmado! Meses adicionados à sua assinatura.",
      );
      setPending(null);
      setShipping(emptyShipping);
      await Promise.all([refetchOverview(), refetchRewards()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao resgatar");
    } finally {
      setBusy(null);
    }
  };

  const handleRedeemClick = async (r: Reward) => {
    if (r.kind === "device") {
      setShipping(emptyShipping);
      setPending(r);
      return;
    }
    if (!(await confirmAction(`Confirmar resgate de ${r.name} por ${formatPoints(r.points_cost)} pontos?`))) return;
    void runRedeem(r.id);
  };

  const submitShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    void runRedeem(pending.id, shipping);
  };

  return (
    <div className="min-h-dvh bg-surface-50">
      <div role="main" id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-bold">Catálogo de prêmios</h1>
            <p className="mt-1 text-sm text-surface-900/70">Troque seus pontos por meses grátis ou aparelhos de streaming.</p>
          </div>
          <div className="rounded-2xl bg-brand px-6 py-3 text-white shadow-lg shadow-brand/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Seus pontos</p>
            <p className="font-display text-2xl font-bold">{formatPoints(overview.points)}</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const affordable = overview.points >= r.points_cost;
            const inStock = r.stock > 0;
            const disabled = !affordable || !inStock || busy === r.id;
            const isDevice = r.kind === "device";
            return (
              <div key={r.id} className="flex flex-col rounded-3xl border border-surface-200 bg-card p-6">
                <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-accent/10">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="h-full w-full rounded-2xl object-cover" />
                  ) : isDevice ? (
                    <Package className="size-12 text-brand/60" aria-hidden="true" />
                  ) : (
                    <CalendarPlus className="size-12 text-brand/60" aria-hidden="true" />
                  )}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isDevice ? "bg-brand/10 text-brand" : "bg-accent/10 text-accent-dark"}`}>
                    {isDevice ? <Truck className="size-3" aria-hidden="true" /> : <CalendarPlus className="size-3" aria-hidden="true" />}
                    {isDevice ? "Aparelho" : "Assinatura"}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold">{r.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-surface-900/70">{r.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">
                    <Sparkles className="size-3" aria-hidden="true" /> {formatPoints(r.points_cost)} pts
                  </span>
                  <span className={inStock ? "text-surface-900/70" : "font-bold text-red-500"}>
                    {inStock ? `${r.stock} disponíveis` : "Esgotado"}
                  </span>
                </div>
                <button
                  onClick={() => handleRedeemClick(r)}
                  disabled={disabled}
                  aria-busy={busy === r.id}
                  className="mt-4 min-h-11 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-foreground transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-900/40"
                >
                  {busy === r.id
                    ? "Resgatando…"
                    : !inStock
                      ? "Esgotado"
                      : !affordable
                        ? `Faltam ${formatPoints(r.points_cost - overview.points)} pts`
                        : isDevice
                          ? "Resgatar aparelho"
                          : "Resgatar"}
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">Meus resgates</h2>
          <p className="mt-1 text-sm text-surface-900/70">Acompanhe o status de cada troca.</p>
          {overview.redemptions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-surface-200 bg-card p-8 text-center text-sm text-surface-900/60">
              Você ainda não fez nenhum resgate. Escolha um prêmio acima para começar.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-card">
              {overview.redemptions.map((r) => {
                const rw = r.reward as { name: string; kind?: string; subscription_months?: number | null } | null;
                const isDev = rw?.kind === "device";
                const statusMap: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
                  pending: { label: "Aguardando envio", cls: "bg-amber-100 text-amber-800", icon: <Clock className="size-3" aria-hidden="true" /> },
                  shipped: { label: "Enviado", cls: "bg-blue-100 text-blue-800", icon: <Truck className="size-3" aria-hidden="true" /> },
                  fulfilled: { label: "Concluído", cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="size-3" aria-hidden="true" /> },
                  cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-800", icon: <Clock className="size-3" aria-hidden="true" /> },
                };
                const s = statusMap[r.status] ?? statusMap.pending;
                return (
                  <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-surface-50 p-2 text-brand">
                        {isDev ? <Package className="size-5" aria-hidden="true" /> : <Gift className="size-5" aria-hidden="true" />}
                      </div>
                      <div>
                        <p className="font-medium">{rw?.name ?? "Prêmio"}</p>
                        <p className="text-xs text-surface-900/60">
                          {formatDateBR(r.created_at)} · {formatPoints(r.points_spent)} pts
                        </p>
                        {isDev && r.shipping_city ? (
                          <p className="mt-1 text-xs text-surface-900/60">
                            Envio para {r.shipping_city}/{r.shipping_state} · CEP {r.shipping_zip}
                          </p>
                        ) : null}
                        {r.tracking_code ? (
                          <p className="mt-1 text-xs font-medium text-brand">Rastreio: {r.tracking_code}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-xs font-bold sm:self-center ${s.cls}`}>
                      {s.icon}
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Endereço de entrega</DialogTitle>
            <DialogDescription>
              {pending ? `${pending.name} · ${formatPoints(pending.points_cost)} pts` : ""} — envio grátis em até 15 dias úteis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitShipping} className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="ship-recipient">Nome do destinatário</Label>
              <Input id="ship-recipient" required value={shipping.recipient} onChange={(e) => setShipping({ ...shipping, recipient: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ship-address">Endereço completo (rua, nº, complemento)</Label>
              <Input id="ship-address" required value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="ship-city">Cidade</Label>
                <Input id="ship-city" required value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="ship-state">UF</Label>
                <Input id="ship-state" required maxLength={2} value={shipping.state} onChange={(e) => setShipping({ ...shipping, state: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="ship-zip">CEP</Label>
                <Input id="ship-zip" required inputMode="numeric" placeholder="00000-000" value={shipping.zip} onChange={(e) => setShipping({ ...shipping, zip: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="ship-phone">Telefone</Label>
                <Input id="ship-phone" inputMode="tel" placeholder="(11) 99999-9999" value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ship-notes">Observações (opcional)</Label>
              <Textarea id="ship-notes" rows={2} value={shipping.notes} onChange={(e) => setShipping({ ...shipping, notes: e.target.value })} />
            </div>
            <DialogFooter className="mt-2">
              <button type="button" onClick={() => setPending(null)} className="min-h-11 rounded-xl border border-surface-200 px-4 text-sm font-bold">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === pending?.id}
                aria-busy={busy === pending?.id}
                className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-60"
              >
                {busy === pending?.id ? "Confirmando…" : "Confirmar resgate"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
