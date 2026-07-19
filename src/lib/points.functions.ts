import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointEvent = {
  id: string;
  kind: string;
  points: number;
  description: string | null;
  created_at: string;
};

export const getMyPointsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("point_events")
      .select("id, kind, points, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { events: (data ?? []) as PointEvent[] };
  });




export const getGrowthMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("growth_metrics");
    if (error) throw new Error(error.message);
    return data as {
      months: Array<{ month: string; new_users: number; new_subscriptions: number; revenue_cents: number }>;
      mrr_cents: number;
      total_points_outstanding: number;
      total_points_awarded: number;
    };
  });

export type LeaderboardEntry = { user_id: string; display_name: string | null; points: number };

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { period?: "week" | "month" | "all" }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("leaderboard", { _period: data.period ?? "month" });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeaderboardEntry[];
  });
