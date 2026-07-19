import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listActivePlans, listActiveRewards } from "@/lib/plans.functions";
import { formatCurrencyBRL, formatPoints } from "@/lib/format";
import {
  ArrowRight,
  Check,
  Gift,
  Sparkles,
  ShieldCheck,
  Zap,
  Trophy,
  Menu,
  X,
  Tv,
  Users,
  Star,
  Play,
  Award,
  Smartphone,
  Wifi,
  ChevronDown,
} from "lucide-react";

const plansQO = queryOptions({ queryKey: ["public", "plans"], queryFn: () => listActivePlans() });
const rewardsQO = queryOptions({ queryKey: ["public", "rewards"], queryFn: () => listActiveRewards() });

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(rewardsQO),
    ]);
  },
  component: LandingPage,
});

function DarkNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 z-50 border-b border-purple-900/40 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="KMKZ IPTV - início">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500 font-black text-white shadow-[0_0_25px_rgba(147,51,234,0.7)]">
            K
          </div>
          <span className="font-display text-lg font-black tracking-tight text-white sm:text-xl">
            KMKZ <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">IPTV</span>
          </span>
        </Link>
        <div className="hidden gap-6 text-sm font-medium md:flex lg:gap-8">
          <a href="#planos" className="text-slate-300 transition hover:text-pink-400">Planos</a>
          <a href="#gamificacao" className="text-slate-300 transition hover:text-pink-400">Recompensas</a>
          <a href="#recursos" className="text-slate-300 transition hover:text-pink-400">Recursos</a>
          <a href="#faq" className="text-slate-300 transition hover:text-pink-400">FAQ</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] transition hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] sm:text-sm"
            >
              Meu painel
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:inline">Entrar</Link>
              <Link
                to="/auth"
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] transition hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] sm:text-sm"
              >
                Criar conta
              </Link>
            </>
          )}
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 grid size-9 place-items-center rounded-lg border border-purple-900/60 text-slate-300 md:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-purple-900/40 bg-slate-950 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm">
            <a href="#planos" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-slate-200 hover:bg-purple-900/30">Planos</a>
            <a href="#gamificacao" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-slate-200 hover:bg-purple-900/30">Recompensas</a>
            <a href="#recursos" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-slate-200 hover:bg-purple-900/30">Recursos</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-slate-200 hover:bg-purple-900/30">FAQ</a>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(147,51,234,0.35),transparent_60%),radial-gradient(900px_500px_at_90%_10%,rgba(236,72,153,0.25),transparent_60%)]" />
      <div aria-hidden className="absolute -left-20 top-32 size-72 rounded-full bg-purple-600/30 blur-3xl" />
      <div aria-hidden className="absolute right-0 top-64 size-96 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-pink-300">
              <Sparkles className="size-3.5" /> Streaming + Programa VIP
            </span>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Assista sem limites e{" "}
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                ganhe prêmios reais
              </span>{" "}
              a cada uso.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              +50.000 canais, filmes e séries em 4K com programa de fidelidade que te recompensa por login diário, indicações e conquistas.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_rgba(236,72,153,0.5)] transition hover:shadow-[0_0_50px_rgba(236,72,153,0.8)]"
              >
                Ganhe 100 pts ao criar conta
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </Link>
              <a href="#planos" className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10">
                <Play className="size-4" /> Ver planos
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-400" /> Pagamento seguro</span>
              <span className="inline-flex items-center gap-1.5"><Wifi className="size-4 text-purple-400" /> Sem travamento</span>
              <span className="inline-flex items-center gap-1.5"><Award className="size-4 text-pink-400" /> Suporte 24/7</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-slate-900/60 to-pink-900/30 p-6 backdrop-blur-xl shadow-[0_0_60px_rgba(147,51,234,0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-pink-300">Painel VIP</p>
                  <p className="mt-1 font-display text-2xl font-black text-white">💠 Diamante</p>
                </div>
                <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.6)]">
                  <Trophy className="size-6 text-white" />
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-950/60 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Seus pontos</p>
                <p className="mt-1 font-display text-4xl font-black text-white">12.480</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-3/4 bg-gradient-to-r from-purple-500 to-pink-500" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  { k: "Indicações", v: "24" },
                  { k: "Streak", v: "18d" },
                  { k: "Prêmios", v: "6" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-white/5 p-3">
                    <p className="font-display text-lg font-black text-white">{s.v}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 break-normal hyphens-none [word-break:keep-all]">{s.k}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -left-4 top-8 hidden rounded-2xl border border-emerald-500/30 bg-slate-900/90 px-3 py-2 shadow-lg backdrop-blur sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">+50 pts</p>
              <p className="text-xs text-white">Indicação confirmada</p>
            </div>
            <div className="absolute -right-4 bottom-10 hidden rounded-2xl border border-pink-500/30 bg-slate-900/90 px-3 py-2 shadow-lg backdrop-blur sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pink-400">Novo prêmio</p>
              <p className="text-xs text-white">🎁 Fire TV Stick</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Tv, title: "+50.000 canais", desc: "TV ao vivo, filmes, séries e esportes em qualidade 4K." },
    { icon: Smartphone, title: "Multi-dispositivo", desc: "Smart TV, Android, iOS, Fire Stick, computador." },
    { icon: Zap, title: "Servidor turbo", desc: "Sem buffering. Baixa latência, uptime 99,9%." },
    { icon: ShieldCheck, title: "100% seguro", desc: "Pagamento criptografado e ativação instantânea." },
    { icon: Award, title: "Programa VIP", desc: "Ganhe pontos por login, indicação e resgate prêmios." },
    { icon: Users, title: "Suporte 24/7", desc: "Time humano por WhatsApp e chat, sempre online." },
  ];
  return (
    <section id="recursos" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-pink-400">Recursos</span>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tudo o que você precisa em uma assinatura
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="group rounded-3xl border border-purple-900/40 bg-white/[0.03] p-6 backdrop-blur transition hover:border-pink-500/40 hover:bg-white/[0.06]"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-600/30 to-pink-500/30 text-pink-300 transition group-hover:scale-110">
                <it.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">{it.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gamification({ rewards }: { rewards: any[] }) {
  return (
    <section id="gamificacao" className="relative border-y border-purple-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-pink-400">Programa VIP</span>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
              Quanto mais você usa,{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                mais você ganha
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-300">
              Ganhe pontos automaticamente por login diário, compartilhamento, indicações e conquistas. Troque por meses grátis, descontos ou prêmios físicos.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: Sparkles, label: "+100 pts de boas-vindas ao criar conta" },
                { icon: Zap, label: "+5 pts por login diário (streak até 30 dias)" },
                { icon: Users, label: "+50 pts por indicação confirmada" },
                { icon: Trophy, label: "5 níveis VIP: Bronze → Diamante" },
              ].map((r) => (
                <li key={r.label} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-purple-600 to-pink-500 text-white">
                    <r.icon className="size-3.5" />
                  </span>
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {rewards.slice(0, 4).map((r, i) => (
              <div
                key={r.id}
                className={`group relative overflow-hidden rounded-3xl border border-purple-500/30 bg-slate-900/60 p-5 backdrop-blur transition hover:border-pink-500/50 hover:shadow-[0_0_30px_rgba(236,72,153,0.35)] ${
                  i === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-pink-300">
                  <Gift className="size-3" /> Prêmio
                </div>
                <p className="font-display text-lg font-bold text-white">{r.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.description}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-black text-pink-400">
                  <Sparkles className="size-3.5" /> {formatPoints(r.points_cost)} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing({ plans }: { plans: any[] }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const filtered = plans.filter((p) =>
    billing === "annual" ? p.period === "annual" || p.period === "semiannual" : p.period === "monthly" || p.period === "quarterly",
  );

  return (
    <section id="planos" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-pink-400">Planos</span>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            Escolha o plano ideal
          </h2>
          <p className="mt-3 text-slate-300">Cancele quando quiser. Ativação imediata após o pagamento.</p>

          <div className="mt-6 inline-flex rounded-full border border-purple-500/40 bg-slate-900/50 p-1">
            {(["monthly", "annual"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest transition ${
                  billing === b
                    ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {b === "monthly" ? "Curto prazo" : "Longo prazo"}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plan) => {
            const monthly = plan.price_cents / Math.max(1, Math.round(plan.duration_days / 30));
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-7 backdrop-blur transition hover:-translate-y-1 ${
                  plan.is_popular
                    ? "border-pink-500/60 bg-gradient-to-b from-purple-900/40 to-slate-900/60 shadow-[0_0_50px_rgba(236,72,153,0.4)]"
                    : "border-purple-900/50 bg-slate-900/40 hover:border-purple-500/60"
                }`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(236,72,153,0.6)]">
                    ⭐ Mais popular
                  </span>
                )}
                <p className="font-display text-xl font-black text-white">{plan.name}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-black text-white">{formatCurrencyBRL(plan.price_cents)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {formatCurrencyBRL(monthly)}/mês equivalente
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
                  <span className="rounded-full bg-purple-500/15 px-2 py-1 text-purple-300">📺 {plan.screen_limit ?? 1} tela{(plan.screen_limit ?? 1) > 1 ? "s" : ""}</span>
                  <span className="rounded-full bg-pink-500/15 px-2 py-1 text-pink-300">🎬 {plan.quality ?? "HD"}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">+{plan.referral_points} pts/indic.</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-300">
                  {(plan.features ?? []).map((f: string) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-pink-400" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  className={`mt-6 inline-flex items-center justify-center rounded-full py-3 text-sm font-bold transition ${
                    plan.is_popular
                      ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-[0_0_25px_rgba(236,72,153,0.5)] hover:shadow-[0_0_40px_rgba(236,72,153,0.8)]"
                      : "border border-purple-500/40 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  Assinar agora
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { name: "Rafael M.", text: "Zero travamento. Assisto na TV, tablet e celular. Já ganhei um Fire Stick só indicando amigos!", rating: 5 },
    { name: "Camila S.", text: "Suporte responde na hora pelo WhatsApp. Assinei o anual e já estou no nível Ouro.", rating: 5 },
    { name: "João P.", text: "Melhor custo-benefício que já testei. Qualidade 4K de verdade em canais de esportes.", rating: 5 },
  ];
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-pink-400">Depoimentos</span>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            +12.000 assinantes satisfeitos
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <div key={t.name} className="rounded-3xl border border-purple-900/40 bg-white/[0.03] p-6 backdrop-blur">
              <div className="flex gap-0.5 text-pink-400">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-200">"{t.text}"</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">— {t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const items = [
    { q: "Como funciona a ativação?", a: "Após confirmar o pagamento, sua assinatura é ativada instantaneamente. Você recebe o acesso por e-mail e WhatsApp." },
    { q: "Em quantos aparelhos posso assistir?", a: "Depende do plano. Do plano Básico (1 tela) ao Premium (4 telas simultâneas em 4K)." },
    { q: "Como funcionam os pontos VIP?", a: "Você ganha 100 pontos de boas-vindas, +5 por login diário, +50 por indicação confirmada, e mais por conquistas. Troque no catálogo por meses grátis ou prêmios físicos." },
    { q: "Posso cancelar quando quiser?", a: "Sim. Sem multa, sem burocracia. Cancele direto pelo painel do assinante." },
    { q: "Aceitam PIX?", a: "Sim, aceitamos PIX (aprovação instantânea), cartão de crédito e Mercado Pago." },
  ];
  return (
    <section id="faq" className="relative border-t border-purple-900/40 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-pink-400">Perguntas frequentes</span>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">FAQ</h2>
        </div>
        <div className="mt-10 space-y-3">
          {items.map((it, i) => (
            <div key={it.q} className="overflow-hidden rounded-2xl border border-purple-900/50 bg-slate-900/40 backdrop-blur">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="font-semibold text-white">{it.q}</span>
                <ChevronDown className={`size-4 shrink-0 text-pink-400 transition ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-5 pb-5 text-sm text-slate-300">{it.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-purple-900/40 bg-slate-950 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 font-black text-white">K</div>
            <span className="font-display font-black text-white">KMKZ IPTV</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} KMKZ IPTV. Todos os direitos reservados.</p>
          <div className="flex gap-5 text-xs text-slate-400">
            <a href="#faq" className="hover:text-pink-400">FAQ</a>
            <Link to="/auth" className="hover:text-pink-400">Entrar</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: rewards } = useSuspenseQuery(rewardsQO);
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-pink-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white">
        Pular para o conteúdo
      </a>
      <DarkNav />
      <main id="main">
        <Hero />
        <Features />
        <Gamification rewards={rewards} />
        <Pricing plans={plans} />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
