import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { listActivePlans } from "@/lib/plans.functions";
import { getMyOverview } from "@/lib/user.functions";
import { subscribeToPlan } from "@/lib/subscriptions.functions";
import { formatCurrencyBRL, PLAN_PERIOD_LABEL, PLAN_ECONOMY_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { useId, useMemo, useState } from "react";
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
type PayMethod = "card" | "pix";

function CheckoutPage() {
  const { planId } = Route.useParams();
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: overview } = useSuspenseQuery(overviewQO);
  const subscribeFn = useServerFn(subscribeToPlan);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<PayMethod>("card");
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
      <div className="min-h-dvh bg-surface-50">
        <AppNav isAdmin={overview.isAdmin} />
        <main role="main" id="main" className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Plano não encontrado</h1>
          <Link to="/planos" className="mt-4 inline-block text-brand hover:underline">
            Ver planos disponíveis
          </Link>
        </main>
      </div>
    );
  }

  const canAdvance = step === 1 ? true : step === 2 ? (method === "pix" ? true : cardValid) : accept;

  const handleConfirm = async () => {
    if (!accept) return;
    setBusy(true);
    try {
      await subscribeFn({ data: { planId: plan.id } });
      toast.success(`Assinatura ${plan.name} ativada!`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao ativar plano";
      toast.error(msg);
      setBusy(false);
    }
  };

  const economy = PLAN_ECONOMY_LABEL[plan.period];

  return (
    <div className="min-h-dvh bg-surface-50">
      <AppNav isAdmin={overview.isAdmin} />
      <main role="main" id="main" className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/planos"
          className="inline-flex items-center gap-1.5 text-sm text-surface-900/70 hover:text-surface-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar aos planos
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Finalizar assinatura</h1>
            <p className="mt-1 text-sm text-surface-900/70">
              Etapa {step} de 3 — {step === 1 ? "Revisão" : step === 2 ? "Pagamento" : "Confirmação"}
            </p>
          </div>
          <Stepper current={step} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-surface-200 bg-white p-6 sm:p-8">
            {step === 1 && <StepReview plan={plan} />}
            {step === 2 && (
              <StepPayment method={method} setMethod={setMethod} card={card} setCard={setCard} />
            )}
            {step === 3 && (
              <StepConfirm
                plan={plan}
                method={method}
                accept={accept}
                setAccept={setAccept}
              />
            )}

            <div className="mt-8 flex items-center justify-between border-t border-surface-200 pt-6">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                disabled={step === 1 || busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-surface-900/70 hover:text-surface-900 disabled:opacity-40"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => canAdvance && setStep((s) => ((s + 1) as Step))}
                  disabled={!canAdvance}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-surface-900 px-5 text-sm font-bold text-white hover:bg-surface-900/90 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Lock className="size-4" aria-hidden="true" />
                  {busy ? "Ativando…" : "Confirmar e ativar"}
                </button>
              )}
            </div>
          </section>

          <aside className="h-fit space-y-4">
            <div className="rounded-3xl bg-surface-900 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Resumo do pedido</p>
              <h2 className="mt-2 font-display text-xl font-bold">Plano {plan.name}</h2>
              <p className="text-sm text-white/70">{PLAN_PERIOD_LABEL[plan.period]}</p>

              {economy && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {economy}
                </div>
              )}

              <div className="my-5 h-px bg-white/10" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-white/70">
                  <dt>Subtotal</dt>
                  <dd>{formatCurrencyBRL(plan.price_cents)}</dd>
                </div>
                <div className="flex justify-between text-white/70">
                  <dt>Taxas</dt>
                  <dd>Grátis</dd>
                </div>
              </dl>
              <div className="my-5 h-px bg-white/10" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/70">Total</span>
                <span className="font-display text-3xl font-bold">{formatCurrencyBRL(plan.price_cents)}</span>
              </div>
              <p className="mt-2 text-xs text-white/50">
                Cobrança única · +{plan.referral_points} pts por indicação
              </p>
            </div>

            <ul className="space-y-2 rounded-2xl border border-surface-200 bg-white p-5 text-xs text-surface-900/70">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
                Pagamento 100% seguro
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />
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
                  ? "bg-brand text-brand-foreground"
                  : active
                  ? "bg-surface-900 text-white ring-4 ring-surface-900/10"
                  : "bg-surface-200 text-surface-900/50"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : it.n}
            </div>
            <span
              className={`hidden text-xs font-semibold sm:inline ${
                active ? "text-surface-900" : "text-surface-900/50"
              }`}
            >
              {it.label}
            </span>
            {i < items.length - 1 && <div className="h-px w-6 bg-surface-200" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepReview({ plan }: { plan: { name: string; features: unknown; referral_points: number } }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold">Revise seu plano</h2>
      <p className="mt-1 text-sm text-surface-900/70">Confira tudo que está incluso antes de continuar.</p>

      <div className="mt-6 space-y-3">
        {(plan.features as string[]).map((f) => (
          <div key={f} className="flex items-start gap-3 rounded-xl border border-surface-200 p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="text-sm text-surface-900/80">{f}</span>
          </div>
        ))}
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="text-sm text-surface-900/80">
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
}: {
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  card: { number: string; name: string; exp: string; cvc: string };
  setCard: (c: { number: string; name: string; exp: string; cvc: string }) => void;
}) {
  const numId = useId();
  const nameId = useId();
  const expId = useId();
  const cvcId = useId();

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Método de pagamento</h2>
      <p className="mt-1 text-sm text-surface-900/70">Escolha como prefere pagar. Ambiente de demonstração.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMethod("card")}
          aria-pressed={method === "card"}
          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
            method === "card" ? "border-brand bg-brand/5" : "border-surface-200 hover:border-surface-300"
          }`}
        >
          <CreditCard className="size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Cartão de crédito</p>
            <p className="text-xs text-surface-900/60">Visa, Master, Elo</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMethod("pix")}
          aria-pressed={method === "pix"}
          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
            method === "pix" ? "border-brand bg-brand/5" : "border-surface-200 hover:border-surface-300"
          }`}
        >
          <QrCode className="size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Pix</p>
            <p className="text-xs text-surface-900/60">Aprovação imediata</p>
          </div>
        </button>
      </div>

      {method === "card" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={numId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-surface-900/70">
              Número do cartão
            </label>
            <input
              id={numId}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              aria-required="true"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={nameId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-surface-900/70">
              Nome impresso no cartão
            </label>
            <input
              id={nameId}
              autoComplete="cc-name"
              placeholder="Como está no cartão"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm uppercase focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor={expId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-surface-900/70">
              Validade
            </label>
            <input
              id={expId}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={card.exp}
              onChange={(e) => setCard({ ...card, exp: formatExp(e.target.value) })}
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor={cvcId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-surface-900/70">
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
              className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              aria-required="true"
            />
          </div>
          <p className="sm:col-span-2 flex items-center gap-2 text-xs text-surface-900/60">
            <Lock className="size-3.5" aria-hidden="true" />
            Seus dados são criptografados. Nenhum número é armazenado nesta demonstração.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-surface-200 p-8 text-center">
          <QrCode className="mx-auto size-16 text-surface-900/40" aria-hidden="true" />
          <p className="mt-4 font-bold">QR Code Pix</p>
          <p className="mt-1 text-xs text-surface-900/60">
            No próximo passo, geraremos um Pix simulado com ativação imediata.
          </p>
        </div>
      )}
    </div>
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
      <h2 className="font-display text-xl font-bold">Quase lá!</h2>
      <p className="mt-1 text-sm text-surface-900/70">
        Revise o pedido e confirme para ativar sua assinatura imediatamente.
      </p>

      <dl className="mt-6 space-y-3 rounded-2xl bg-surface-50 p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-surface-900/70">Plano</dt>
          <dd className="font-semibold">{plan.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-surface-900/70">Período</dt>
          <dd className="font-semibold">{PLAN_PERIOD_LABEL[plan.period]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-surface-900/70">Pagamento</dt>
          <dd className="font-semibold">{method === "card" ? "Cartão de crédito" : "Pix"}</dd>
        </div>
        <div className="flex justify-between border-t border-surface-200 pt-3">
          <dt className="text-surface-900/70">Total a pagar</dt>
          <dd className="font-display text-lg font-bold">{formatCurrencyBRL(plan.price_cents)}</dd>
        </div>
      </dl>

      <label htmlFor={termsId} className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-surface-200 p-4 hover:bg-surface-50">
        <input
          id={termsId}
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 size-4 rounded border-surface-300 text-brand focus:ring-brand/30"
          aria-required="true"
        />
        <span className="text-sm text-surface-900/80">
          Li e aceito os <a href="#" className="font-semibold text-brand hover:underline">Termos de uso</a> e a{" "}
          <a href="#" className="font-semibold text-brand hover:underline">Política de privacidade</a>.
        </span>
      </label>
    </div>
  );
}
