import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminGetPaymentSettings,
  adminSavePaymentSettings,
  adminGetWhatsappSettings,
  adminSaveWhatsappSettings,
  adminListExpiring,
  adminMarkReminderSent,
  PAYMENTS_DEFAULTS,
  WHATSAPP_DEFAULTS,
  type PaymentSettings,
  type WhatsappSettings,
} from "@/lib/settings.functions";
import { adminListPlans } from "@/lib/admin.functions";
import { whatsappReminderLink } from "@/lib/payments";
import { CreditCard, Globe, MessageCircle, Save, Send, Clock, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: SettingsPage,
});

const inputCls =
  "w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground";

function SettingsPage() {
  const qc = useQueryClient();
  const getPay = useServerFn(adminGetPaymentSettings);
  const savePay = useServerFn(adminSavePaymentSettings);
  const getWa = useServerFn(adminGetWhatsappSettings);
  const saveWa = useServerFn(adminSaveWhatsappSettings);
  const listExpiring = useServerFn(adminListExpiring);
  const markSent = useServerFn(adminMarkReminderSent);
  const listPlans = useServerFn(adminListPlans);

  const payQ = useQuery({ queryKey: ["admin", "settings", "payments"], queryFn: () => getPay() });
  const waQ = useQuery({ queryKey: ["admin", "settings", "whatsapp"], queryFn: () => getWa() });
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: () => listPlans() });
  const expQ = useQuery({ queryKey: ["admin", "expiring"], queryFn: () => listExpiring() });

  const [pay, setPay] = useState<PaymentSettings>(PAYMENTS_DEFAULTS);
  const [wa, setWa] = useState<WhatsappSettings>(WHATSAPP_DEFAULTS);
  const [busy, setBusy] = useState<"pay" | "wa" | null>(null);

  useEffect(() => { if (payQ.data) setPay(payQ.data); }, [payQ.data]);
  useEffect(() => { if (waQ.data) setWa(waQ.data); }, [waQ.data]);

  const handleSavePay = async () => {
    setBusy("pay");
    try {
      await savePay({ data: pay });
      toast.success("Configurações de pagamento salvas");
      qc.invalidateQueries({ queryKey: ["admin", "settings", "payments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveWa = async () => {
    setBusy("wa");
    try {
      await saveWa({ data: { ...wa, days_before: Number(wa.days_before) || 7 } });
      toast.success("Avisos de vencimento salvos");
      qc.invalidateQueries({ queryKey: ["admin", "settings", "whatsapp"] });
      qc.invalidateQueries({ queryKey: ["admin", "expiring"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  };

  const renewUrl = typeof window !== "undefined" ? `${window.location.origin}/planos` : "/planos";

  return (
    <main role="main" id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow text-accent">Administração</p>
      <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gateways de pagamento por região e avisos automáticos de renovação.
      </p>

      {/* Pagamentos */}
      <section className="card-surface mt-8 p-5 sm:p-7">
        <header className="flex items-center gap-2">
          <CreditCard className="size-5 text-brand" aria-hidden="true" />
          <h2 className="font-display text-xl font-black">Gateways de pagamento</h2>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="br-provider">Brasil (BRL)</label>
            <select
              id="br-provider"
              className={inputCls}
              value={pay.br_provider}
              onChange={(e) => setPay({ ...pay, br_provider: e.target.value as PaymentSettings["br_provider"] })}
            >
              <option value="infinitepay">InfinityPay</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="intl-provider">Internacional (USD)</label>
            <select
              id="intl-provider"
              className={inputCls}
              value={pay.intl_provider}
              onChange={(e) => setPay({ ...pay, intl_provider: e.target.value as PaymentSettings["intl_provider"] })}
            >
              <option value="stripe">Stripe</option>
              <option value="infinitepay">InfinityPay</option>
            </select>
          </div>
        </div>

        {/* InfinityPay */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-bold">InfinityPay</h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!pay.infinitepay.enabled}
                onChange={(e) => setPay({ ...pay, infinitepay: { ...pay.infinitepay, enabled: e.target.checked } })}
              />
              Ativo
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ip-handle">Handle da conta (@)</label>
              <input
                id="ip-handle"
                className={inputCls}
                placeholder="kmkziptv"
                value={pay.infinitepay.handle}
                onChange={(e) => setPay({ ...pay, infinitepay: { ...pay.infinitepay, handle: e.target.value } })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ip-redirect">URL de retorno</label>
              <input
                id="ip-redirect"
                className={inputCls}
                placeholder="https://kmkzstream.lovable.app/dashboard"
                value={pay.infinitepay.redirect_url}
                onChange={(e) => setPay({ ...pay, infinitepay: { ...pay.infinitepay, redirect_url: e.target.value } })}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O link é gerado como <code>checkout.infinitepay.io/&#123;handle&#125;</code> com o valor do plano em reais.
          </p>
        </div>

        {/* Stripe */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold">
              <Globe className="size-4 text-accent" aria-hidden="true" /> Stripe (internacional)
            </h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!pay.stripe.enabled}
                onChange={(e) => setPay({ ...pay, stripe: { ...pay.stripe, enabled: e.target.checked } })}
              />
              Ativo
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cole o Payment Link do Stripe correspondente a cada plano (valores em dólar).
          </p>
          <div className="mt-4 space-y-3">
            {(plansQ.data ?? []).map((p: any) => (
              <div key={p.id} className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
                <span className="text-sm font-semibold">{p.name}</span>
                <input
                  className={inputCls}
                  placeholder="https://buy.stripe.com/..."
                  value={pay.stripe.payment_links?.[p.id] ?? ""}
                  onChange={(e) =>
                    setPay({
                      ...pay,
                      stripe: {
                        ...pay.stripe,
                        payment_links: { ...(pay.stripe.payment_links ?? {}), [p.id]: e.target.value },
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePay}
          disabled={busy === "pay"}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon disabled:opacity-50"
        >
          <Save className="size-4" aria-hidden="true" />
          {busy === "pay" ? "Salvando…" : "Salvar pagamentos"}
        </button>
      </section>

      {/* WhatsApp */}
      <section className="card-surface mt-6 p-5 sm:p-7">
        <header className="flex items-center gap-2">
          <MessageCircle className="size-5 text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-xl font-black">Aviso de vencimento (WhatsApp)</h2>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!wa.enabled}
              onChange={(e) => setWa({ ...wa, enabled: e.target.checked })}
            />
            Avisos ativos
          </label>
          <div>
            <label className={labelCls} htmlFor="wa-days">Dias antes do vencimento</label>
            <input
              id="wa-days"
              type="number"
              min={1}
              max={60}
              className={inputCls}
              value={wa.days_before}
              onChange={(e) => setWa({ ...wa, days_before: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="wa-support">WhatsApp do suporte</label>
            <input
              id="wa-support"
              className={inputCls}
              placeholder="+55 11 90000-0000"
              value={wa.support_number}
              onChange={(e) => setWa({ ...wa, support_number: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls} htmlFor="wa-template">Mensagem</label>
          <textarea
            id="wa-template"
            rows={3}
            className={inputCls}
            value={wa.template}
            onChange={(e) => setWa({ ...wa, template: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Variáveis disponíveis: <code>{"{nome}"}</code> <code>{"{plano}"}</code> <code>{"{dias}"}</code>{" "}
            <code>{"{data}"}</code> <code>{"{link}"}</code>
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveWa}
          disabled={busy === "wa"}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon disabled:opacity-50"
        >
          <Save className="size-4" aria-hidden="true" />
          {busy === "wa" ? "Salvando…" : "Salvar avisos"}
        </button>

        {/* Fila de vencimentos */}
        <div className="mt-8">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold">
            <Clock className="size-4 text-amber-400" aria-hidden="true" />
            Assinaturas vencendo ({expQ.data?.length ?? 0})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O aviso dentro do app é enviado automaticamente todo dia. Use o botão para disparar o WhatsApp.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Assinante</th>
                  <th className="py-2 pr-3">Plano</th>
                  <th className="py-2 pr-3">Vence em</th>
                  <th className="py-2 pr-3">Último aviso</th>
                  <th className="py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(expQ.data ?? []).map((row) => {
                  const link = whatsappReminderLink({
                    phone: row.whatsapp,
                    template: wa.template,
                    name: row.display_name ?? "",
                    plan: row.plan_name,
                    daysLeft: row.days_left,
                    endsAt: row.ends_at,
                    renewUrl,
                  });
                  return (
                    <tr key={row.subscription_id} className="border-b border-border/40">
                      <td className="py-2 pr-3">
                        <span className="font-semibold">{row.display_name ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground">{row.whatsapp ?? "sem WhatsApp"}</span>
                      </td>
                      <td className="py-2 pr-3">{row.plan_name}</td>
                      <td className="py-2 pr-3">
                        {row.days_left} dia(s) · {new Date(row.ends_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {row.reminder_sent_at ? new Date(row.reminder_sent_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={async () => {
                              try {
                                await markSent({ data: { subscriptionId: row.subscription_id } });
                                qc.invalidateQueries({ queryKey: ["admin", "expiring"] });
                              } catch { /* ignore */ }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <Send className="size-3.5" aria-hidden="true" /> Avisar
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">sem número</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(expQ.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma assinatura vencendo nos próximos {wa.days_before} dias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
