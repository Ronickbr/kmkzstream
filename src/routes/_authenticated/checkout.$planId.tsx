import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivePlans } from "@/lib/plans.functions";
import { getMyOverview } from "@/lib/user.functions";
import { subscribeToPlan } from "@/lib/subscriptions.functions";
import { formatCurrencyBRL, PLAN_PERIOD_LABEL, PLAN_ECONOMY_LABEL } from "@/lib/format";
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
} from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });
const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/checkout/$planId")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(overviewQO),
    ]),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3;
type PayMethod = "card" | "pix" | "mercadopago";

const METHOD_LABEL: Record<PayMethod, string> = {
  card: "Cartão de crédito",
  pix: "Pix",
  mercadopago: "Mercado Pago",
};

function CheckoutPage() {
  const { planId } = Route.useParams();
  const { data: plans } = useSuspenseQuery(plansQO);
  useSuspenseQuery(overviewQO);
  const subscribeFn = useServerFn(subscribeToPlan);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<PayMethod>("pix");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvc: "" });
  const [accept, setAccept] = useState(false);

  const plan = plans.find((p) => p.id === planId);

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
    try {
      await subscribeFn({ data: { planId: plan.id } });
      celebrate();
      toast.success(`Assinatura ${plan.name} ativada! 🎉`);
      setTimeout(() => navigate({ to: "/dashboard" }), 900);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao ativar plano";
      toast.error(msg);
      setBusy(false);
    }
  };

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
            {step === 2 && <StepPayment method={method} setMethod={setMethod} card={card} setCard={setCard} plan={plan} />}
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
                  <dd>{formatCurrencyBRL(plan.price_cents)}</dd>
                </div>
                <div className="flex justify-between text-white/80">
                  <dt>Taxas</dt>
                  <dd>Grátis</dd>
                </div>
              </dl>
              <div className="my-5 h-px bg-white/20" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/80">Total</span>
                <span className="font-display text-3xl font-black">{formatCurrencyBRL(plan.price_cents)}</span>
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
}: {
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  card: { number: string; name: string; exp: string; cvc: string };
  setCard: (c: { number: string; name: string; exp: string; cvc: string }) => void;
  plan: any;
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
    <div className="mt-6 grid gap-6 rounded-2xl border border-border bg-background/40 p-6 sm:grid-cols-[auto_1fr]">
      <div className="grid place-items-center">
        <div className="rounded-2xl bg-white p-3 shadow-glow">
          <FakeQR />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
          <Clock className="size-3.5" /> Expira em {mm}:{ss}
        </div>
        <p className="mt-2 font-display text-xl font-black">{formatCurrencyBRL(plan.price_cents)}</p>
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
          <dd className="font-display text-lg font-black text-accent">{formatCurrencyBRL(plan.price_cents)}</dd>
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
