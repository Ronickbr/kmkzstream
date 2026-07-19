import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/points.functions";
import { getMyOverview } from "@/lib/user.functions";
import { getVipLevel, maskName } from "@/lib/vip";
import { Sparkles, Trophy, Crown, Medal } from "lucide-react";
import { useState } from "react";

const meQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });
const boardQO = (period: "week" | "month" | "all") =>
  queryOptions({ queryKey: ["leaderboard", period], queryFn: () => getLeaderboard({ data: { period } }) });

export const Route = createFileRoute("/_authenticated/ranking")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(meQO),
      context.queryClient.ensureQueryData(boardQO("month")),
    ]),
  component: RankingPage,
});

function RankingPage() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const { data: me } = useSuspenseQuery(meQO);
  const { data: board } = useSuspenseQuery(boardQO(period));

  const myId = me.profile?.id;
  const myVip = getVipLevel(me.points);
  const myRank = board.findIndex((r) => r.user_id === myId) + 1;

  return (
    <div role="main" id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="eyebrow flex items-center gap-2 text-accent">
          <Sparkles className="size-3.5" /> Ranking VIP
        </p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
          Os fãs mais engajados do <span className="bg-gradient-brand bg-clip-text text-transparent">KMKZ</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Suba de nível VIP acumulando pontos por login diário, indicações e conquistas.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <p className="eyebrow">Seu nível</p>
          <p className="mt-2 font-display text-2xl font-black" style={{ color: myVip.color }}>
            {myVip.emoji} {myVip.name}
          </p>
        </div>
        <div className="card-surface p-5">
          <p className="eyebrow">Seus pontos</p>
          <p className="mt-2 font-display text-2xl font-black text-accent">{me.points.toLocaleString("pt-BR")}</p>
        </div>
        <div className="card-surface p-5">
          <p className="eyebrow">Sua posição</p>
          <p className="mt-2 font-display text-2xl font-black">
            {myRank > 0 ? `#${myRank}` : "Sem posição"}
          </p>
        </div>
      </section>

      <div className="mb-4 inline-flex rounded-full border border-border bg-card/50 p-1">
        {(["week", "month", "all"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
              period === p ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "week" ? "Semana" : p === "month" ? "Mês" : "Geral"}
          </button>
        ))}
      </div>

      <section className="card-surface overflow-hidden">
        <ol className="divide-y divide-border/60">
          {board.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              Ninguém pontuou nesse período ainda. Seja o primeiro!
            </li>
          )}
          {board.map((row, i) => {
            const vip = getVipLevel(row.points);
            const isMe = row.user_id === myId;
            const Icon = i === 0 ? Crown : i === 1 ? Trophy : i === 2 ? Medal : null;
            return (
              <li
                key={row.user_id}
                className={`flex items-center gap-4 p-4 sm:p-5 ${isMe ? "bg-gradient-brand/10" : ""}`}
              >
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-black ${
                    i < 3 ? "bg-gradient-brand text-white shadow-neon" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {Icon ? <Icon className="size-5" /> : `#${i + 1}`}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {maskName(row.display_name)} {isMe && <span className="text-accent">(você)</span>}
                  </p>
                  <p className="text-xs" style={{ color: vip.color }}>
                    {vip.emoji} {vip.name}
                  </p>
                </div>
                <p className="font-display text-lg font-black text-accent">
                  {row.points.toLocaleString("pt-BR")}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">pts</span>
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
