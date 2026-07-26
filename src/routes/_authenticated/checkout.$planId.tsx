import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { subscribeToPlan, getMyPaymentStatus } from "@/lib/subscriptions.functions";
import { useQueryClient } from "@tanstack/react-query";

import { plansQueryOptions as plansQO, overviewQueryOptions as overviewQO } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { getCheckoutSettings } from "@/lib/settings.functions";
import { checkoutUrl, gatewayForLocale, GATEWAY_LABEL, type Gateway } from "@/lib/payments";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_PERIOD_LABEL, PLAN_ECONOMY_LABEL } from "@/lib/format";
import { celebrate } from "@/lib/confetti";
import { toast } from "sonner";
import { useId, useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Copy,
  Wallet,
  Clock,
  Globe,
  Loader2,
  XCircle,
  RefreshCw,
  LifeBuoy,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/checkout/$planId")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(overviewQO),
    ]),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3;
type PayState = "idle" | "verifying" | "confirmed" | "failed";
type PayMethod = "card" | "pix" | "mercadopago" | "gateway";

const METHOD_LABEL: Record<PayMethod, string> = {
  card: "Cartão de crédito",
  pix: "Pix",
  mercadopago: "Mercado Pago",
  gateway: "Gateway online",
};

function CheckoutPage() {
  const { planPrice, locale } = useI18n();
  const getSettings = useServerFn(getCheckoutSettings);
  const { data: paySettings } = useQuery({
    queryKey: ["checkout", "settings"],
    queryFn: () => getSettings(),
    staleTime: 5 * 60_000,
  });
  const gateway = gatewayForLocale(locale, paySettings);
  const { planId } = Route.useParams();
  const { data: plans } = useSuspenseQuery(plansQO);
  useSuspenseQuery(overviewQO);
  const subscribeFn = useServerFn(subscribeToPlan);
  const statusFn = useServerFn(getMyPaymentStatus);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<PayMethod>(locale === "pt" ? "pix" : "gateway");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvc: "" });
  const [accept, setAccept] = useState(false);
  const [payState, setPayState] = useState<PayState>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const plan = plans.find((p) => p.id === planId);

  // Verificação automática do status do pagamento enquanto aguardamos a confirmação.
  const { data: payStatus } = useQuery({
    queryKey: ["checkout", "status", planId, attempts],
    queryFn: () => statusFn({ data: { planId } }),
    enabled: payState === "verifying",
    // Fallback: o webhook é a fonte principal; o polling lento só cobre falhas de realtime.
    refetchInterval: payState === "verifying" ? 15000 : false,
    staleTime: 0,
  });

  // Realtime: o webhook atualiza a assinatura no banco e recebemos o evento na hora.
  useEffect(() => {
    if (payState !== "verifying") return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`checkout-sub-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${uid}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ["checkout", "status"] });
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [payState, queryClient]);

  useEffect(() => {
    if (payState !== "verifying") return;
    if (payStatus?.state === "failed") {
      setPayError("O pagamento foi recusado pelo provedor. Seu cadastro está salvo — tente novamente.");
      setPayState("failed");
      return;
    }
    if (payStatus?.state === "confirmed") {
      setPayState("confirmed");
      localStorage.removeItem("kmkz_pending_plan");
      queryClient.invalidateQueries();
      celebrate();
      toast.success("Pagamento confirmado! Acesso liberado 🎉");
    }
  }, [payStatus, payState, queryClient]);

  // Se a confirmação demorar demais, mostramos a tela de falha com opção de tentar novamente.
  useEffect(() => {
    if (payState !== "verifying") return;
    const timeout = setTimeout(() => {
      setPayState((s: PayState) => {
        if (s !== "verifying") return s;
        setPayError(
          "Não recebemos a confirmação do pagamento a tempo. Seu cadastro está salvo — você pode tentar novamente ou concluir mais tarde.",
        );
        return "failed";
      });
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [payState, attempts]);

  const cardValid = useMemo(
    () =>
      card.number.replace(/\s/g, "").length >= 13 &&
      card.name.trim().length >= 3 &&
      /^\d{2}\/\d{2}$/.test(card.exp) &&
      /^\d{3,4}$/.test(card.cvc),
    [card],
  );


  if (!plan) {
    return (
      <div className="min-h-dvh">
        <main role="main" id="main" className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Plano não encontrado</h1>
          <Link to="/planos" className="mt-4 inline-block text-brand hover:underline">
            Ver planos disponíveis
          </Link>
        </main>
      </div>
    );
  }

  const canAdvance = step === 1 ? true : step === 2 ? (method !== "card" ? true : cardValid) : accept;

  const handleConfirm = async () => {
    if (!accept) return;
    setBusy(true);
    setPayError(null);
    // Abre a aba antes do await para não ser bloqueada pelo navegador.
    const gatewayTab = method === "gateway" ? window.open("", "_blank", "noopener,noreferrer") : null;
    try {
      // A referência de pagamento é gerada no servidor e devolvida aqui.
      const created = await subscribeFn({
        data: { planId: plan.id, provider: method === "gateway" ? gateway : undefined },
      });

      if (method === "gateway") {
        const url = checkoutUrl({
          gateway,
          settings: paySettings,
          planId: plan.id,
          planName: plan.name,
          priceCentsBRL: plan.price_cents,
          orderRef: created.paymentRef,
        });
        if (!url) {
          gatewayTab?.close();
          toast.error(`${GATEWAY_LABEL[gateway]} ainda não está configurado. Escolha outro método.`);
          setBusy(false);
          return;
        }
        if (gatewayTab) gatewayTab.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
      }
      // A liberação do acesso só acontece quando a verificação automática confirmar o pagamento.
      setAttempts((n) => n + 1);
      setPayState("verifying");

    } catch (e) {
      gatewayTab?.close();
      const msg = e instanceof Error ? e.message : "Não foi possível processar o pagamento.";
      setPayError(msg);
      setPayState("failed");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const retryPayment = () => {
    setPayError(null);
    setPayState("idle");
    setStep(2);
  };

  const checkNow = () => {
    setAttempts((n) => n + 1);
    setPayError(null);
    setPayState("verifying");
  };

  if (payState !== "idle") {
    return (
      <PaymentResultScreen
        state={payState}
        planName={plan.name}
        priceLabel={planPrice(plan)}
        methodLabel={METHOD_LABEL[method]}
        error={payError}
        onRetry={retryPayment}
        onCheckNow={checkNow}
        onEnter={() => navigate({ to: "/dashboard" })}
      />
    );
  }

  const economy = PLAN_ECONOMY_LABEL[plan.period];


  return (
    <div className="min-h-dvh">
      <main role="main" id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link to="/planos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar aos planos
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-accent">Checkout seguro</p>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">Finalizar assinatura</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapa {step} de 3 — {step === 1 ? "Revisão" : step === 2 ? "Pagamento" : "Confirmação"}
            </p>
          </div>
          <Stepper current={step} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="card-surface p-6 sm:p-8">
            {step === 1 && <StepReview plan={plan} />}
            {step === 2 && (
              <StepPayment
                method={method}
                setMethod={setMethod}
                card={card}
                setCard={setCard}
                plan={plan}
                gateway={gateway}
                gatewayReady={
                  !!checkoutUrl({
                    gateway,
                    settings: paySettings,
                    planId: plan.id,
                    planName: plan.name,
                    priceCentsBRL: plan.price_cents,
                    orderRef: "preview",
                  })
                }
                isBR={locale === "pt"}
              />
            )}
            {step === 3 && <StepConfirm plan={plan} method={method} accept={accept} setAccept={setAccept} />}

            <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                disabled={step === 1 || busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => canAdvance && setStep((s) => ((s + 1) as Step))}
                  disabled={!canAdvance}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  Continuar
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!accept || busy}
                  aria-busy={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Lock className="size-4" aria-hidden="true" />
                  {busy ? "Ativando…" : "Confirmar e ativar"}
                </button>
              )}
            </div>
          </section>

          <aside className="h-fit space-y-4">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-6 text-white shadow-glow">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Resumo</p>
              <h2 className="mt-2 font-display text-xl font-black">Plano {plan.name}</h2>
              <p className="text-sm text-white/80">{PLAN_PERIOD_LABEL[plan.period]}</p>

              {economy && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {economy}
                </div>
              )}

              <div className="my-5 h-px bg-white/20" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-white/80">
                  <dt>Subtotal</dt>
                  <dd>{planPrice(plan)}</dd>
                </div>
                <div className="flex justify-between text-white/80">
                  <dt>Taxas</dt>
                  <dd>Grátis</dd>
                </div>
              </dl>
              <div className="my-5 h-px bg-white/20" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/80">Total</span>
                <span className="font-display text-3xl font-black">{planPrice(plan)}</span>
              </div>
              <p className="mt-2 text-xs text-white/70">Cobrança única · +{plan.referral_points} pts por indicação</p>
            </div>

            <ul className="card-surface space-y-2 p-5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
                Pagamento 100% seguro
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
                Ativação instantânea
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
                Cancele quando quiser
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const items: { n: Step; label: string }[] = [
    { n: 1, label: "Revisão" },
    { n: 2, label: "Pagamento" },
    { n: 3, label: "Confirmação" },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso do checkout">
      {items.map((it, i) => {
        const active = current === it.n;
        const done = current > it.n;
        return (
          <li key={it.n} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition ${
                done
                  ? "bg-gradient-brand text-white shadow-neon"
                  : active
                  ? "bg-gradient-brand text-white ring-4 ring-brand/20"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : it.n}
            </div>
            <span className={`hidden text-xs font-semibold sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {it.label}
            </span>
            {i < items.length - 1 && <div className="h-px w-6 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepReview({ plan }: { plan: any }) {
  const { planPrice } = useI18n();
  return (
    <div>
      <h2 className="font-display text-xl font-black">Revise seu plano</h2>
      <p className="mt-1 text-sm text-muted-foreground">Confira tudo que está incluso antes de continuar.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-300">📺 {plan.screen_limit ?? 1} tela{(plan.screen_limit ?? 1) > 1 ? "s" : ""}</span>
        <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-300">🎬 {plan.quality ?? "HD"}</span>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">+{plan.referral_points} pts/indic.</span>
      </div>

      <div className="mt-6 space-y-3">
        {(plan.features as string[]).map((f) => (
          <div key={f} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="text-sm text-foreground/90">{f}</span>
          </div>
        ))}
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="text-sm text-foreground/90">
            <strong>+{plan.referral_points} pontos</strong> por cada indicação confirmada — troque por prêmios.
          </span>
        </div>
      </div>
    </div>
  );
}

function StepPayment({
  method,
  setMethod,
  card,
  setCard,
  plan,
  gateway,
  gatewayReady,
  isBR,
}: {
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  card: { number: string; name: string; exp: string; cvc: string };
  setCard: (c: { number: string; name: string; exp: string; cvc: string }) => void;
  plan: any;
  gateway: Gateway;
  gatewayReady: boolean;
  isBR: boolean;
}) {
  const numId = useId();
  const nameId = useId();
  const expId = useId();
  const cvcId = useId();

  const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <div>
      <h2 className="font-display text-xl font-black">Método de pagamento</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ambiente de demonstração — nenhum valor será cobrado.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PayOption
          id="gateway"
          current={method}
          onClick={() => setMethod("gateway")}
          icon={Globe}
          title={GATEWAY_LABEL[gateway]}
          hint={gatewayReady ? "Pagamento online seguro" : "Não configurado"}
          recommended
        />
      </div>

      {!isBR && (
        <p className="mt-3 text-xs text-muted-foreground">
          International payments are processed by {GATEWAY_LABEL[gateway]} in US dollars.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PayOption id="pix" current={method} onClick={() => setMethod("pix")} icon={QrCode} title="Pix" hint="Aprovação imediata" recommended />
        <PayOption id="card" current={method} onClick={() => setMethod("card")} icon={CreditCard} title="Cartão" hint="Visa, Master, Elo" />
        <PayOption id="mercadopago" current={method} onClick={() => setMethod("mercadopago")} icon={Wallet} title="Mercado Pago" hint="Saldo ou boleto" />
      </div>

      {method === "card" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={numId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Número do cartão
            </label>
            <input
              id={numId}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-mono tracking-widest focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={nameId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nome impresso
            </label>
            <input
              id={nameId}
              autoComplete="cc-name"
              placeholder="COMO ESTÁ NO CARTÃO"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm uppercase focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label htmlFor={expId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Validade
            </label>
            <input
              id={expId}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={card.exp}
              onChange={(e) => setCard({ ...card, exp: formatExp(e.target.value) })}
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-mono focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label htmlFor={cvcId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              CVC
            </label>
            <input
              id={cvcId}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              maxLength={4}
              value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-mono focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <p className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            Seus dados são criptografados. Nenhum número é armazenado nesta demonstração.
          </p>
        </div>
      )}

      {method === "pix" && <PixPreview plan={plan} />}

      {method === "mercadopago" && (
        <div className="mt-6 rounded-2xl border border-border bg-background/40 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
              <Wallet className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold">Mercado Pago</p>
              <p className="text-xs text-muted-foreground">Você será redirecionado para concluir o pagamento com saldo, cartão ou boleto.</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline size-3.5 align-[-2px] text-accent" />
            Simulação: no próximo passo confirmamos a ativação sem cobrança real.
          </p>
        </div>
      )}
    </div>
  );
}

function PayOption({
  id,
  current,
  onClick,
  icon: Icon,
  title,
  hint,
  recommended,
}: {
  id: PayMethod;
  current: PayMethod;
  onClick: () => void;
  icon: any;
  title: string;
  hint: string;
  recommended?: boolean;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition ${
        active ? "border-brand bg-brand/10 shadow-neon" : "border-border bg-background/40 hover:border-brand/50"
      }`}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-gradient-brand px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-glow">
          Recomendado
        </span>
      )}
      <Icon className={`size-5 ${active ? "text-accent" : "text-brand"}`} aria-hidden="true" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

function PixPreview({ plan }: { plan: any }) {
  const { planPrice } = useI18n();
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(15 * 60);
  const code = useMemo(
    () =>
      `00020126580014BR.GOV.BCB.PIX0136kmkz-${plan.id.slice(0, 8)}-${Date.now().toString(36)}5204000053039865802BR5910KMKZ Streaming6009SAO PAULO62070503***6304ABCD`,
    [plan.id],
  );

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <div className="mt-6 grid gap-6 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-[auto_1fr] sm:p-6">
      <div className="grid place-items-center">
        <div className="rounded-2xl bg-white p-3 shadow-glow">
          <FakeQR />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
          <Clock className="size-3.5" /> Expira em {mm}:{ss}
        </div>
        <p className="mt-2 font-display text-xl font-black">{planPrice(plan)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Escaneie o QR Code no seu app do banco ou copie o código abaixo.
        </p>
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pix copia e cola</label>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={code}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full min-w-0 truncate rounded-xl border border-border bg-background/60 px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-bold text-white shadow-glow"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-400" /> Confirmação em segundos. Sua assinatura é ativada automaticamente.
        </p>
      </div>
    </div>
  );
}

function FakeQR() {
  const cells = 25;
  const seed = 42;
  const rand = (i: number, j: number) => ((i * 73 + j * 191 + seed) * 2654435761) % 100 > 55;
  return (
    <svg width="180" height="180" viewBox={`0 0 ${cells} ${cells}`} aria-label="QR code de demonstração">
      <rect width={cells} height={cells} fill="#fff" />
      {Array.from({ length: cells }).map((_, i) =>
        Array.from({ length: cells }).map((__, j) => {
          const isCorner = (i < 7 && j < 7) || (i < 7 && j >= cells - 7) || (i >= cells - 7 && j < 7);
          if (isCorner) return null;
          return rand(i, j) ? <rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill="#0b0518" /> : null;
        }),
      )}
      {[[0, 0], [0, cells - 7], [cells - 7, 0]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={y} y={x} width={7} height={7} fill="#0b0518" />
          <rect x={y + 1} y={x + 1} width={5} height={5} fill="#fff" />
          <rect x={y + 2} y={x + 2} width={3} height={3} fill="#9333ea" />
        </g>
      ))}
    </svg>
  );
}

function StepConfirm({
  plan,
  method,
  accept,
  setAccept,
}: {
  plan: { name: string; price_cents: number; period: string };
  method: PayMethod;
  accept: boolean;
  setAccept: (v: boolean) => void;
}) {
  const termsId = useId();
  const { planPrice } = useI18n();

  return (
    <div>
      <h2 className="font-display text-xl font-black">Quase lá!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Revise o pedido e confirme para ativar sua assinatura imediatamente.
      </p>

      <dl className="mt-6 space-y-3 rounded-2xl border border-border bg-background/40 p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Plano</dt>
          <dd className="font-semibold">{plan.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Período</dt>
          <dd className="font-semibold">{PLAN_PERIOD_LABEL[plan.period]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Pagamento</dt>
          <dd className="font-semibold">{METHOD_LABEL[method]}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 pt-3">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-display text-lg font-black text-accent">{planPrice(plan)}</dd>
        </div>
      </dl>

      <label
        htmlFor={termsId}
        className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/40 p-4 hover:border-brand/50"
      >
        <input
          id={termsId}
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 size-4 rounded border-border text-brand focus:ring-brand/30"
        />
        <span className="text-sm text-foreground/90">
          Li e aceito os <Link to="/termos" target="_blank" className="font-semibold text-accent hover:underline">Termos de uso</Link> e a{" "}
          <Link to="/privacidade" target="_blank" className="font-semibold text-accent hover:underline">Política de privacidade</Link>.
        </span>
      </label>
    </div>
  );
}

/** Tela de verificação, confirmação e falha/recusa do pagamento. */
function PaymentResultScreen({
  state,
  planName,
  priceLabel,
  methodLabel,
  error,
  onRetry,
  onCheckNow,
  onEnter,
}: {
  state: Exclude<PayState, "idle">;
  planName: string;
  priceLabel: string;
  methodLabel: string;
  error: string | null;
  onRetry: () => void;
  onCheckNow: () => void;
  onEnter: () => void;
}) {
  const config = {
    verifying: {
      icon: <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />,
      ring: "border-brand/40 bg-brand/10",
      title: "Confirmando seu pagamento…",
      text: "Estamos verificando automaticamente o status junto ao provedor. Isso costuma levar poucos segundos — pode deixar esta tela aberta.",
    },
    confirmed: {
      icon: <CheckCircle2 className="size-8 text-emerald-400" aria-hidden="true" />,
      ring: "border-emerald-500/40 bg-emerald-500/10",
      title: "Pagamento confirmado!",
      text: "Seu acesso foi liberado. Aproveite todos os benefícios do seu plano e comece a indicar amigos para ganhar pontos.",
    },
    failed: {
      icon: <XCircle className="size-8 text-rose-400" aria-hidden="true" />,
      ring: "border-rose-500/40 bg-rose-500/10",
      title: "Pagamento não confirmado",
      text: error ?? "O pagamento foi recusado ou não pôde ser concluído.",
    },
  }[state];

  return (
    <div className="min-h-dvh">
      <main role="main" id="main" className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="rounded-3xl border border-border bg-card/60 p-6 text-center shadow-glow sm:p-10">
          <div className={`mx-auto grid size-16 place-items-center rounded-2xl border ${config.ring}`}>
            {config.icon}
          </div>
          <h1 className="mt-5 font-display text-2xl font-black tracking-tight sm:text-3xl">{config.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{config.text}</p>

          <dl className="mt-6 space-y-2 rounded-2xl border border-border/70 bg-background/40 p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Plano</dt>
              <dd className="font-semibold">{planName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-semibold">{priceLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Método</dt>
              <dd className="font-semibold">{methodLabel}</dd>
            </div>
          </dl>

          {state === "failed" && (
            <p className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline size-3.5 align-[-2px] text-emerald-400" />
              Seu cadastro continua salvo — nada foi perdido. Você pode tentar novamente agora ou concluir o pagamento depois pela página de planos.
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {state === "confirmed" && (
              <button
                type="button"
                onClick={onEnter}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon"
              >
                Acessar meu painel
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}

            {state === "verifying" && (
              <button
                type="button"
                onClick={onCheckNow}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold hover:border-brand/60"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Verificar agora
              </button>
            )}

            {state === "failed" && (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 text-sm font-bold text-white shadow-glow transition hover:shadow-neon"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={onCheckNow}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold hover:border-brand/60"
                >
                  Já paguei, verificar status
                </button>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/planos" className="hover:text-foreground">Ver planos</Link>
            <Link to="/suporte" className="inline-flex items-center gap-1 hover:text-foreground">
              <LifeBuoy className="size-3.5" aria-hidden="true" />
              Falar com o suporte
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
