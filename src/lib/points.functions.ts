import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointEvent = {
  id: string;
  kind: string;
  points: number;
  description: string | null;
  created_at: string;
};

export type DailyLoginStatus = {
  claimed_today: boolean;
  points: number;
  next_available_at: string;
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

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: rule } = await supabase
      .from("point_rules")
      .select("points, daily_limit")
      .eq("id", "daily_login")
      .maybeSingle();
    const { count } = await supabase
      .from("point_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "daily_login")
      .gte("created_at", startOfDay.toISOString());

    const nextDay = new Date(startOfDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const dailyLogin: DailyLoginStatus = {
      claimed_today: (count ?? 0) > 0,
      points: rule?.points ?? 5,
      next_available_at: nextDay.toISOString(),
    };

    return { events: (data ?? []) as PointEvent[], dailyLogin };
  });

export const claimDailyLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("claim_daily_login");
    if (error) {
      const map: Record<string, string> = {
        already_claimed_today: "Você já resgatou o bônus de hoje.",
        rule_inactive: "Recompensa de login desativada.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      throw new Error(key ? map[key] : error.message);
    }
    return data as { points: number };
  });

export const awardSharePoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("award_share_points");
    if (error) {
      const map: Record<string, string> = {
        daily_limit_reached: "Limite diário de compartilhamentos atingido.",
        rule_inactive: "Recompensa de compartilhamento desativada.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      throw new Error(key ? map[key] : error.message);
    }
    return data as { points: number; remaining: number };
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
