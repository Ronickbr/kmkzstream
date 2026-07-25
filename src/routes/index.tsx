import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { plansQueryOptions as plansQO, rewardsQueryOptions as rewardsQO } from "@/lib/queries";
import { formatPoints } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import broadcastWall from "@/assets/broadcast-wall.jpg";
import { ArrowUpRight, Check, Menu, X, Plus, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(plansQO),
      context.queryClient.ensureQueryData(rewardsQO),
    ]);
  },
  component: LandingPage,
});

/* ------------------------------- Primitives ------------------------------- */

function TallyDot({ label }: { label?: string }) {
  const { t } = useI18n();
  const text = label ?? t("hero.live");
  return (
    <span className="inline-flex items-center gap-2 font-mono-b text-[11px] font-medium uppercase tracking-[0.22em] text-white/80">
      <span className="relative inline-block size-2 rounded-full bg-[color:var(--color-tally)] animate-tally" />
      {text}
    </span>
  );
}

function TimecodeBar({ ch, label }: { ch: string; label: string }) {
  const tcRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
    const tick = (now: number) => {
      // Atualiza no máximo 10x/s — imperceptível ao olho, elimina 60% do custo
      if (now - last >= 100) {
        const ms = now - start;
        const h = Math.floor(ms / 3_600_000) % 24;
        const m = Math.floor(ms / 60_000) % 60;
        const s = Math.floor(ms / 1000) % 60;
        const f = Math.floor((ms % 1000) / 40);
        if (tcRef.current) {
          tcRef.current.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
        }
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="inline-flex items-center gap-3 rounded-sm border border-white/10 bg-black/50 px-3 py-1.5 font-mono-b text-[11px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
      <TallyDot />
      <span className="text-white/40">·</span>
      <span className="text-[color:var(--color-tally)]">{ch}</span>
      <span className="text-white/40">·</span>
      <span>{label}</span>
      <span className="text-white/40">·</span>
      <span ref={tcRef} className="tabular-nums">00:00:00:00</span>
    </div>
  );
}

/* --------------------------------- Nav ---------------------------------- */

function Nav() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const links = [
    { href: "#grade", n: "01", label: t("nav.grid") },
    { href: "#recompensas", n: "02", label: t("nav.rewards") },
    { href: "#planos", n: "03", label: t("nav.plans") },
    { href: "#faq", n: "04", label: t("nav.faq") },
  ];

  return (
    <nav
      aria-label={t("common.mainNav")}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-[color:var(--color-vinyl)]/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label={t("nav.home")}>
          <span className="grid size-7 place-items-center rounded-sm bg-[color:var(--color-tally)] font-broadcast text-base leading-none text-white">
            K
          </span>
          <span className="font-broadcast text-xl leading-none tracking-[0.02em] text-white">
            KMKZ<span className="text-white/40">·</span>STREAMING
          </span>
          <span className="hidden md:inline"><TallyDot label="ON AIR" /></span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group inline-flex items-baseline gap-2 font-body-b text-[13px] font-medium text-white/70 transition hover:text-white"
              >
                <span className="font-mono-b text-[10px] text-white/30 group-hover:text-[color:var(--color-tally)]">
                  {l.n}
                </span>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {signedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-sm bg-white px-4 py-2 font-mono-b text-[11px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-[color:var(--color-tally)] hover:text-white"
            >
              {t("nav.dashboard")} <ArrowUpRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden font-body-b text-[13px] font-medium text-white/70 hover:text-white sm:inline">
                {t("nav.signin")}
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-sm bg-[color:var(--color-tally)] px-4 py-2 font-mono-b text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-black"
              >
                {t("nav.subscribe")} <ArrowUpRight className="size-3.5" />
              </Link>
            </>
          )}
          <button
            aria-label={t("common.menu")}
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 grid size-9 place-items-center rounded-sm border border-white/10 text-white/70 md:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-white/[0.06] bg-[color:var(--color-vinyl)] md:hidden">
          <ul className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-baseline gap-3 rounded-sm px-3 py-2.5 font-body-b text-sm text-white/80 hover:bg-white/5"
                >
                  <span className="font-mono-b text-[10px] text-white/30">{l.n}</span>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

/* --------------------------------- Hero --------------------------------- */

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_600px_at_15%_-10%,rgba(123,44,255,0.28),transparent_65%),radial-gradient(700px_500px_at_100%_20%,rgba(255,45,85,0.12),transparent_60%)]"
      />
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-12 gap-6 px-4 pb-16 pt-10 sm:px-8 sm:pt-14 lg:gap-8 lg:pb-24 lg:pt-20">
        {/* Left column — thesis */}
        <div className="col-span-12 lg:col-span-7">
          <TimecodeBar ch="CH.001" label={t("hero.tc")} />

          <h1 className="mt-8 font-broadcast text-[clamp(3.25rem,13vw,8.5rem)] leading-[0.86] tracking-[0.005em] text-white">
            {t("hero.title1")}
            <br />
            {t("hero.title2")}
            <br />
            <span className="text-[color:var(--color-tally)]">{t("hero.title3")}</span>
          </h1>

          <div className="mt-8 grid max-w-2xl grid-cols-12 gap-x-6 gap-y-3">
            <p className="col-span-12 font-body-b text-[15px] leading-relaxed text-white/70 sm:col-span-9 sm:text-[16px]">
              {t("hero.lead.pre")} <span className="text-white">{t("hero.lead.channels")}</span>{t("hero.lead.post")}
            </p>
            <div className="col-span-12 flex items-center gap-2 sm:col-span-3 sm:justify-end">
              <span className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">
                {t("hero.signal")}
              </span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-3 rounded-sm bg-[color:var(--color-tally)] px-6 py-4 font-mono-b text-xs font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-black"
            >
              {t("hero.cta1")}
              <ArrowUpRight className="size-4 transition group-hover:rotate-45" />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center gap-3 rounded-sm border border-white/15 bg-white/[0.03] px-6 py-4 font-mono-b text-xs font-bold uppercase tracking-[0.22em] text-white/85 backdrop-blur transition hover:border-white/40 hover:bg-white/[0.06]"
            >
              {t("hero.cta2")}
            </a>
          </div>

          {/* Meta strip */}
          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              { k: t("hero.stat1"), v: "5.128" },
              { k: t("hero.stat2"), v: "12.4k" },
              { k: t("hero.stat3"), v: "99,97%" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">{s.k}</dt>
                <dd className="mt-1 font-broadcast text-3xl leading-none text-white sm:text-4xl">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right column — monitor wall */}
        <aside className="col-span-12 lg:col-span-5">
          <figure className="relative crt-frame overflow-hidden">
            <img
              src={broadcastWall}
              alt="Parede de monitores em uma sala de controle transmitindo canais simultaneamente."
              width={1280}
              height={1280}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-cover"
            />

            <div aria-hidden className="pointer-events-none absolute inset-0 scanlines" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-1/2 h-32 animate-scan bg-gradient-to-b from-transparent via-white/8 to-transparent" />
            {/* Overlay UI */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
              <div className="flex items-start justify-between">
                <div className="rounded-sm bg-black/60 px-2 py-1 font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur">
                  REC · 4K · HDR
                </div>
                <TallyDot label="LIVE" />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="rounded-sm bg-black/60 px-2 py-1.5 font-mono-b text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                  {t("hero.ch42")}
                </div>
                <div className="rounded-sm bg-black/60 px-2 py-1.5 font-mono-b text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                  {t("hero.simultaneous")}
                </div>
              </div>
            </div>
          </figure>
          {/* Below-figure caption */}
          <figcaption className="mt-3 flex items-center justify-between font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">
            <span>{t("hero.figcaption")}</span>
            <span>25 fps</span>
          </figcaption>
        </aside>
      </div>

      {/* Ticker */}
      <Ticker />
    </section>
  );
}

function Ticker() {
  const items = [
    "Futebol · Brasileirão",
    "F1 · GP Interlagos",
    "UFC · Card Principal",
    "NBA · Regular Season",
    "FILMES · ESTREIAS",
    "Séries · HBO · Netflix · Prime",
    "Infantil · Cartoon · Disney",
    "Notícias 24h",
    "PPV · Grandes eventos",
    "Documentários",
  ];
  const loop = [...items, ...items];
  return (
    <div className="relative border-y border-white/[0.08] bg-black/40 py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[color:var(--color-vinyl)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[color:var(--color-vinyl)] to-transparent" />
      <div className="flex w-max animate-ticker items-center gap-10 font-mono-b text-[11px] uppercase tracking-[0.22em] text-white/60">
        {loop.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <span className="size-1.5 rounded-full bg-[color:var(--color-tally)]" />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Grade -------------------------------- */

function Grade() {
  const { t } = useI18n();
  const channels = [
    { n: "CH.001", cat: t("grade.futebol"), tag: t("grade.tag.futebol"), accent: true },
    { n: "CH.014", cat: t("grade.filmes"), tag: t("grade.tag.filmes") },
    { n: "CH.027", cat: t("grade.series"), tag: t("grade.tag.series") },
    { n: "CH.041", cat: t("grade.f1"), tag: t("grade.tag.f1") },
    { n: "CH.058", cat: t("grade.ufc"), tag: t("grade.tag.ufc"), accent: true },
    { n: "CH.072", cat: t("grade.noticias"), tag: t("grade.tag.noticias") },
    { n: "CH.089", cat: t("grade.infantil"), tag: t("grade.tag.infantil") },
    { n: "CH.103", cat: t("grade.doc"), tag: t("grade.tag.doc") },
  ];
  return (
    <section id="grade" className="relative border-b border-white/[0.06] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-6 px-4 sm:px-8">
        <header className="col-span-12 lg:col-span-4">
          <span className="font-mono-b text-[10px] uppercase tracking-[0.24em] text-white/40">{t("grade.section")}</span>
          <h2 className="mt-4 font-broadcast text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.9] text-white">
            {t("grade.title1")} <span className="text-[color:var(--color-tally)]">{t("grade.title2")}</span>.
          </h2>
          <p className="mt-5 max-w-md font-body-b text-[15px] leading-relaxed text-white/60">
            {t("grade.lead")}
          </p>
        </header>
        <ul className="col-span-12 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.06] md:grid-cols-4 lg:col-span-8">
          {channels.map((c) => (
            <li
              key={c.n}
              className="group relative flex aspect-square flex-col justify-between bg-[color:var(--color-vinyl)] p-4 transition hover:bg-black"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono-b text-[11px] tracking-[0.18em] text-white/40 group-hover:text-white/80">
                  {c.n}
                </span>
                {c.accent && <TallyDot label="LIVE" />}
              </div>
              <div>
                <p className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">{c.tag}</p>
                <p className="mt-1 font-broadcast text-3xl leading-none text-white sm:text-4xl">{c.cat}</p>
              </div>
              <div
                aria-hidden
                className="absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-[color:var(--color-tally)]/0 via-[color:var(--color-tally)]/60 to-[color:var(--color-tally)]/0 opacity-0 transition group-hover:opacity-100"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------- Recompensas ---------------------------- */

function Recompensas({ rewards }: { rewards: any[] }) {
  const { t, tc } = useI18n();
  const items = rewards.slice(0, 6);
  return (
    <section id="recompensas" className="relative border-b border-white/[0.06] py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="grid grid-cols-12 gap-6">
          <header className="col-span-12 lg:col-span-5">
            <span className="font-mono-b text-[10px] uppercase tracking-[0.24em] text-white/40">{t("rewards.section")}</span>
            <h2 className="mt-4 font-broadcast text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.9] text-white">
              {t("rewards.title1")}<br />
              {t("rewards.title2")} <span className="text-[color:var(--color-tally)]">{t("rewards.title3")}</span>.
            </h2>
            <p className="mt-5 max-w-md font-body-b text-[15px] leading-relaxed text-white/60">
              {t("rewards.lead")}
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { k: t("rewards.k1"), v: "+10" },
                { k: t("rewards.k2"), v: "+20" },
                { k: t("rewards.k3"), v: "+120" },
                { k: t("rewards.k4"), v: t("rewards.v4") },
              ].map((r) => (
                <div key={r.k} className="border-t border-white/10 pt-3">
                  <dt className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">{r.k}</dt>
                  <dd className="mt-1 font-broadcast text-2xl leading-none text-white">{r.v}</dd>
                </div>
              ))}
            </dl>
          </header>

          <ul className="col-span-12 lg:col-span-7">
            {items.map((r, i) => (
              <li
                key={r.id}
                className="group grid grid-cols-12 items-center gap-4 border-t border-white/10 py-6 transition hover:bg-white/[0.02]"
              >
                <span className="col-span-2 font-mono-b text-[11px] tracking-[0.18em] text-white/40 group-hover:text-[color:var(--color-tally)]">
                  RW.{String(i + 1).padStart(3, "0")}
                </span>
                <div className="col-span-7">
                  <p className="font-broadcast text-2xl leading-tight text-white sm:text-3xl">{tc(r.name)}</p>
                  <p className="mt-1 font-body-b text-[13px] text-white/50">{tc(r.description)}</p>
                </div>
                <div className="col-span-3 text-right">
                  <p className="font-broadcast text-3xl leading-none text-[color:var(--color-tally)] sm:text-4xl">
                    {formatPoints(r.points_cost)}
                  </p>
                  <p className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">{t("common.points")}</p>
                </div>
              </li>
            ))}
            <li className="border-t border-white/10" />
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Planos ------------------------------- */

function Planos({ plans }: { plans: any[] }) {
  const { t, tc, planPrice, planPriceCents, currency, moneyRaw } = useI18n();
  return (
    <section id="planos" className="relative border-b border-white/[0.06] py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <div className="grid grid-cols-12 items-end gap-6">
          <header className="col-span-12 lg:col-span-8">
            <span className="font-mono-b text-[10px] uppercase tracking-[0.24em] text-white/40">{t("plans.section")}</span>
            <h2 className="mt-4 font-broadcast text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.9] text-white">
              {t("plans.title1")}<br />{t("plans.title2")} <span className="text-[color:var(--color-tally)]">{t("plans.title3")}</span>.
            </h2>
          </header>
          <div className="col-span-12 lg:col-span-4 lg:text-right">
            <p className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">
              {t("plans.note")}
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, i) => {
            const months = Math.max(1, Math.round(plan.duration_days / 30));
            const monthly = planPriceCents(plan) / months;
            const isMonthly = plan.period === "monthly";
            return (
              <article
                key={plan.id}
                className={`relative flex h-full flex-col bg-[color:var(--color-vinyl)] p-8`}
              >
                {plan.is_popular && (
                  <span className="absolute right-4 top-4 rounded-sm bg-[color:var(--color-tally)] px-2 py-1 font-mono-b text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                    {t("plans.popular")}
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="font-mono-b text-[11px] tracking-[0.2em] text-white/40">
                    PL.{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {plan.quality ?? "HD"} · {plan.screen_limit ?? 1}{" "}
                    {t((plan.screen_limit ?? 1) > 1 ? "common.screens_other" : "common.screens_one")}
                  </span>
                </div>

                <h3 className="mt-5 font-broadcast text-4xl leading-none text-white sm:text-5xl">{tc(plan.name)}</h3>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-broadcast text-5xl leading-none text-white sm:text-6xl">
                      {planPrice(plan).replace(/[^\d.,]/g, "").trim()}
                    </span>
                    <span className="font-mono-b text-[11px] uppercase tracking-[0.2em] text-white/40">{currency}</span>
                  </div>
                  <p className="mt-2 font-mono-b text-[11px] uppercase tracking-[0.18em] text-white/40">
                    {isMonthly ? "\u00A0" : `${moneyRaw(monthly)}${t("common.perMonth")}`}
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {(plan.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2 font-body-b text-[14px] text-white/75">
                      <Check className="mt-0.5 size-4 shrink-0 text-[color:var(--color-tally)]" />
                      {tc(f)}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/auth"
                  className="group mt-8 inline-flex items-center justify-between rounded-sm border border-white/15 bg-white/[0.03] px-5 py-4 font-mono-b text-[11px] font-bold uppercase tracking-[0.22em] text-white transition hover:border-[color:var(--color-tally)] hover:bg-[color:var(--color-tally)]"
                >
                  {t("plans.cta")} {tc(plan.name)}
                  <ArrowUpRight className="size-4 transition group-hover:rotate-45" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}


/* ---------------------------- Depoimentos ----------------------------- */

function Depoimentos() {
  const { t } = useI18n();
  const items = [
    { name: "Rafael M.", role: t("testimonials.role1"), text: t("testimonials.t1") },
    { name: "Camila S.", role: t("testimonials.role2"), text: t("testimonials.t2") },
    { name: "João P.", role: t("testimonials.role3"), text: t("testimonials.t3") },
  ];
  return (
    <section className="relative border-b border-white/[0.06] py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <header className="mb-14">
          <span className="font-mono-b text-[10px] uppercase tracking-[0.24em] text-white/40">{t("testimonials.section")}</span>
          <h2 className="mt-4 font-broadcast text-[clamp(2.5rem,7.5vw,3.75rem)] leading-[0.9] text-white">
            {t("testimonials.title1")} <span className="text-[color:var(--color-tally)]">{t("testimonials.title2")}</span>.
          </h2>
        </header>
        <div className="grid gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.06] md:grid-cols-3">
          {items.map((item, i) => (
            <blockquote key={item.name} className="flex flex-col justify-between bg-[color:var(--color-vinyl)] p-8">
              <div className="flex items-center gap-2">
                <span className="font-mono-b text-[11px] tracking-[0.2em] text-white/40">
                  TX.{String(i + 1).padStart(2, "0")}
                </span>
                <TallyDot label={t("testimonials.verified")} />
              </div>
              <p className="mt-8 font-broadcast text-2xl leading-tight text-white">
                &ldquo;{item.text}&rdquo;
              </p>
              <footer className="mt-8 border-t border-white/10 pt-4">
                <p className="font-body-b text-sm font-semibold text-white">{item.name}</p>
                <p className="font-mono-b text-[10px] uppercase tracking-[0.2em] text-white/40">{item.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ --------------------------------- */

function FAQ() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  const items = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];
  return (
    <section id="faq" className="relative border-b border-white/[0.06] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-8 px-4 sm:px-8">
        <header className="col-span-12 lg:col-span-4">
          <span className="font-mono-b text-[10px] uppercase tracking-[0.24em] text-white/40">{t("faq.section")}</span>
          <h2 className="mt-4 font-broadcast text-[clamp(2.5rem,7.5vw,3.75rem)] leading-[0.9] text-white">
            {t("faq.title1")}<br />{t("faq.title2")}
          </h2>
        </header>
        <ul className="col-span-12 lg:col-span-8">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <li key={it.q} className="border-t border-white/10 last:border-b">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 py-5 text-left sm:gap-6 sm:py-6"
                >
                  <span className="flex min-w-0 items-baseline gap-2 sm:gap-4">
                    <span className="shrink-0 font-mono-b text-[11px] tracking-[0.18em] text-white/30">
                      Q.{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 font-broadcast text-xl leading-tight text-white sm:text-3xl">
                      {it.q}
                    </span>
                  </span>
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-sm border border-white/10 text-white/60 transition ${
                      isOpen ? "rotate-45 border-[color:var(--color-tally)] text-[color:var(--color-tally)]" : ""
                    }`}
                  >
                    <Plus className="size-4" />
                  </span>
                </button>
                {isOpen && (
                  <p className="max-w-2xl pb-6 pl-0 font-body-b text-[15px] leading-relaxed text-white/70 sm:pl-14">
                    {it.a}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------ Final CTA ----------------------------- */

function FinalCTA() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] py-24 sm:py-32">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(700px_400px_at_50%_50%,rgba(255,45,85,0.18),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1400px] px-4 text-center sm:px-8">
        <TimecodeBar ch="CH.999" label={t("cta.tc")} />
        <h2 className="mx-auto mt-8 max-w-4xl font-broadcast text-[clamp(2.75rem,10vw,7rem)] leading-[0.88] text-white">
          {t("cta.title1")}<br />
          <span className="text-[color:var(--color-tally)]">{t("cta.title2")}</span>
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-3 rounded-sm bg-[color:var(--color-tally)] px-8 py-4 font-mono-b text-xs font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-black"
          >
            {t("cta.primary")} <ArrowUpRight className="size-4 transition group-hover:rotate-45" />
          </Link>
          <a
            href="#planos"
            className="inline-flex items-center gap-3 rounded-sm border border-white/15 bg-white/[0.03] px-8 py-4 font-mono-b text-xs font-bold uppercase tracking-[0.22em] text-white/85 hover:border-white/40"
          >
            {t("cta.secondary")}
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Footer -------------------------------- */

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-[color:var(--color-vinyl)] py-14">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-8 px-4 sm:px-8">
        <div className="col-span-12 lg:col-span-4">
          <div className="flex items-center gap-3">
            <span className="grid size-7 place-items-center rounded-sm bg-[color:var(--color-tally)] font-broadcast text-base leading-none text-white">
              K
            </span>
            <span className="font-broadcast text-xl leading-none text-white">
              KMKZ<span className="text-white/40">·</span>STREAMING
            </span>
          </div>
          <p className="mt-5 max-w-xs font-body-b text-[13px] leading-relaxed text-white/50">
            Master control de streaming premium. Transmitindo desde 2020, sem cortes.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <TallyDot label="ON AIR · 24/7" />
          </div>
        </div>

        <div className="col-span-6 lg:col-span-2">
          <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">Sinal</p>
          <ul className="mt-4 space-y-2 font-body-b text-[13px] text-white/70">
            <li><a href="#grade" className="hover:text-white">A grade</a></li>
            <li><a href="#planos" className="hover:text-white">Planos</a></li>
            <li><a href="#recompensas" className="hover:text-white">Recompensas</a></li>
            <li><a href="#faq" className="hover:text-white">Perguntas frequentes</a></li>
          </ul>
        </div>

        <div className="col-span-6 lg:col-span-2">
          <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">Conta</p>
          <ul className="mt-4 space-y-2 font-body-b text-[13px] text-white/70">
            <li><Link to="/auth" className="hover:text-white">Entrar</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-white">Criar conta</Link></li>
            <li>
              <a href="mailto:suporte@kmkzstream.lovable.app" className="hover:text-white">
                Suporte
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">Legal</p>
          <ul className="mt-4 space-y-2 font-body-b text-[13px] text-white/70">
            <li>
              <Link to="/termos" className="hover:text-white">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-white">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <a href="mailto:privacidade@kmkzstream.lovable.app" className="hover:text-white">
                {t("footer.dpo")}
              </a>
            </li>
          </ul>
          <p className="mt-4 font-body-b text-[12px] leading-relaxed text-white/40">
            {t("footer.intermediary")}
          </p>
        </div>

        <div className="col-span-12 mt-4 border-t border-white/10 pt-6">
          <p className="font-body-b text-[12px] leading-relaxed text-white/40">
            <strong className="text-white/60">{t("footer.disclaimerLabel")}</strong>{" "}
            {t("footer.disclaimer")}
          </p>
          <div className="mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">
              © {new Date().getFullYear()} KMKZ Streaming · {t("footer.rights")}
            </p>
            <div className="flex gap-4 font-mono-b text-[10px] uppercase tracking-[0.22em] text-white/40">
              <Link to="/termos" className="hover:text-white">{t("footer.termsShort")}</Link>
              <Link to="/privacidade" className="hover:text-white">{t("footer.privacyShort")}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------- Page --------------------------------- */

function LandingPage() {
  const { t } = useI18n();
  const { data: plans } = useSuspenseQuery(plansQO);
  const { data: rewards } = useSuspenseQuery(rewardsQO);
  return (
    <div className="min-h-dvh bg-[color:var(--color-vinyl)] text-white font-body-b">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-[color:var(--color-tally)] focus:px-4 focus:py-2 focus:font-mono-b focus:text-xs focus:font-bold focus:uppercase focus:tracking-[0.2em] focus:text-white"
      >
        {t("common.skip")}
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Grade />
        <Recompensas rewards={rewards} />
        <Planos plans={plans} />
        <Depoimentos />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
