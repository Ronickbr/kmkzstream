import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  points_reward: number;
  criteria: { type: string; value: number };
  sort_order: number;
};

export type UserAchievement = { achievement_id: string; unlocked_at: string };

export type AchievementUnlocked = { id: string; name: string; icon: string; points: number };

export const getAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: catalog, error: e1 }, { data: unlocked, error: e2 }] =
      await Promise.all([
        supabase.from("achievements").select("*").eq("active", true).order("sort_order"),
        supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", userId),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    return {
      catalog: (catalog ?? []) as unknown as Achievement[],
      unlocked: (unlocked ?? []) as UserAchievement[],
    };
  });

export const checkAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("check_and_award_achievements");
    if (error) throw new Error(error.message);
    return data as { unlocked: AchievementUnlocked[] };
  });
