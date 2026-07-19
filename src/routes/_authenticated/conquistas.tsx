import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAchievements, checkAchievements, type Achievement } from "@/lib/achievements.functions";
import { formatPoints, formatDateBR } from "@/lib/format";
import { celebrate } from "@/lib/confetti";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Trophy,
  Sparkles,
  Users,
  Crown,
  Flame,
  Gem,
  Gift,
  Share2,
  Lock,
  RefreshCw,
  Filter,
} from "lucide-react";

const qo = queryOptions({ queryKey: ["me", "achievements"], queryFn: () => getAchievements() });

export const Route = createFileRoute("/_authenticated/conquistas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: AchievementsPage,
});

const ICONS: Record<string, any> = {
  trophy: Trophy,
  sparkles: Sparkles,
  users: Users,
  crown: Crown,
  flame: Flame,
  gem: Gem,
  gift: Gift,
  share: Share2,
};

const CATEGORY_LABEL: Record<string, string> = {
  onboarding: "Início",
  referral: "Indicações",
  streak: "Sequência",
  points: "Pontos",
  reward: "Prêmios",
  subscription: "Assinatura",
  general: "Geral",
};

function AchievementsPage() {
  const { data } = useSuspenseQuery(qo);
  const check = useServerFn(checkAchievements);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const unlockedIds = useMemo(() => new Set(data.unlocked.map((u) => u.achievement_id)), [data.unlocked]);
  const unlockedMap = useMemo(
    () => new Map(data.unlocked.map((u) => [u.achievement_id, u.unlocked_at])),
    [data.unlocked],
  );

  const categories = useMemo(() => {
    const set = new Set(data.catalog.map((a) => a.category));
    return ["all", ...Array.from(set)];
  }, [data.catalog]);

  const filtered = filter === "all" ? data.catalog : data.catalog.filter((a) => a.category === filter);

  const unlockedCount = data.unlocked.length;
  const total = data.catalog.length;
  const progress = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
  const totalPointsFromAch = data.catalog
    .filter((a) => unlockedIds.has(a.id))
    .reduce((s, a) => s + a.points_reward, 0);

  const runCheck = async (silent = false) => {
    setBusy(true);
    try {
      const res = await check();
      if (res.unlocked.length > 0) {
        celebrate();
        for (const u of res.unlocked) {
          toast.success(`🏆 ${u.name}${u.points ? ` (+${u.points} pts)` : ""}`);
        }
        qc.invalidateQueries({ queryKey: ["me"] });
      } else if (!silent) {
        toast.info("Nenhuma nova conquista por enquanto. Continue engajado!");
      }
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    void runCheck(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="eyebrow text-accent">Gamificação</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">Conquistas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desbloqueie badges por engajamento e ganhe pontos extras.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-brand/50 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
          Verificar
        </button>
      </header>

      {/* Progress cards */}
      <section className="grid gap-4 sm:grid-cols-2">


        <div className="rounded-3xl border border-border bg-card p-6 shadow-elevate">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Trophy className="size-3.5 text-accent" /> Progresso
          </div>
          <p className="mt-3 font-display text-4xl font-black">
            {unlockedCount}<span className="text-lg text-muted-foreground">/{total}</span>
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Coleção</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/60">
              <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-elevate">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Gem className="size-3.5 text-accent" /> Pontos por conquistas
          </div>
          <p className="mt-3 font-display text-4xl font-black text-accent">{formatPoints(totalPointsFromAch)}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Ganhos por desbloquear badges — somam ao total geral.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" aria-hidden />
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === c
                ? "border-transparent bg-gradient-brand text-white shadow-glow"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "all" ? "Todas" : CATEGORY_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((ach) => (
          <AchievementCard key={ach.id} ach={ach} unlockedAt={unlockedMap.get(ach.id) ?? null} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Nenhuma conquista nesta categoria.
          </p>
        )}
      </section>
    </div>
  );
}

function AchievementCard({ ach, unlockedAt }: { ach: Achievement; unlockedAt: string | null }) {
  const Icon = ICONS[ach.icon] ?? Trophy;
  const unlocked = !!unlockedAt;

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border p-5 transition ${
        unlocked
          ? "border-accent/40 bg-gradient-to-br from-accent/10 via-card to-card shadow-neon"
          : "border-border bg-card opacity-90 hover:opacity-100 hover:border-brand/40"
      }`}
      aria-label={`${ach.name}${unlocked ? " — desbloqueada" : " — bloqueada"}`}
    >
      {unlocked && (
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-accent/20 blur-2xl" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid size-14 place-items-center rounded-2xl ${
            unlocked ? "bg-gradient-brand text-white shadow-glow" : "bg-muted text-muted-foreground"
          }`}
        >
          {unlocked ? <Icon className="size-7" aria-hidden /> : <Lock className="size-6" aria-hidden />}
        </div>
        {ach.points_reward > 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
              unlocked ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            }`}
          >
            <Sparkles className="size-3" aria-hidden />
            +{ach.points_reward}
          </span>
        )}
      </div>

      <h3 className={`mt-4 font-display text-lg font-black ${unlocked ? "text-foreground" : "text-foreground/70"}`}>
        {ach.name}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{ach.description}</p>

      {unlocked ? (
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
          ✓ Desbloqueada em {formatDateBR(unlockedAt)}
        </p>
      ) : (
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Bloqueada
        </p>
      )}
    </article>
  );
}
