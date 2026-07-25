/**
 * Centralized TanStack Query options.
 *
 * One source of truth for query keys and queryFns shared across routes and
 * components. Avoids duplicated `queryOptions({...})` declarations and keeps
 * cache invalidation keys consistent (e.g. `queryKeys.me.overview`).
 */
import { queryOptions } from "@tanstack/react-query";
import { getMyOverview } from "@/lib/user.functions";
import { getMyPointsHistory, getLeaderboard } from "@/lib/points.functions";
import { listActivePlans, listActiveRewards } from "@/lib/plans.functions";
import { getAchievements } from "@/lib/achievements.functions";

export const queryKeys = {
  me: {
    root: ["me"] as const,
    overview: ["me", "overview"] as const,
    pointsHistory: ["me", "points-history"] as const,
    achievements: ["me", "achievements"] as const,
  },
  public: {
    plans: ["public", "plans"] as const,
    rewards: ["public", "rewards"] as const,
  },
  notifications: ["notifications"] as const,
  leaderboard: (period: "week" | "month" | "all") => ["leaderboard", period] as const,
} as const;

export const overviewQueryOptions = queryOptions({
  queryKey: queryKeys.me.overview,
  queryFn: () => getMyOverview(),
});

export const pointsHistoryQueryOptions = queryOptions({
  queryKey: queryKeys.me.pointsHistory,
  queryFn: () => getMyPointsHistory(),
});

export const achievementsQueryOptions = queryOptions({
  queryKey: queryKeys.me.achievements,
  queryFn: () => getAchievements(),
});

export const plansQueryOptions = queryOptions({
  queryKey: queryKeys.public.plans,
  queryFn: () => listActivePlans(),
});

export const rewardsQueryOptions = queryOptions({
  queryKey: queryKeys.public.rewards,
  queryFn: () => listActiveRewards(),
});

export const leaderboardQueryOptions = (period: "week" | "month" | "all") =>
  queryOptions({
    queryKey: queryKeys.leaderboard(period),
    queryFn: () => getLeaderboard({ data: { period } }),
  });
