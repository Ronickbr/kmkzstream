import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rewardId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: redemptionId, error } = await supabase.rpc("redeem_reward", {
      _reward_id: data.rewardId,
    });
    if (error) {
      const map: Record<string, string> = {
        insufficient_points: "Pontos insuficientes para este resgate.",
        reward_out_of_stock: "Prêmio esgotado.",
        reward_inactive: "Prêmio indisponível.",
        reward_not_found: "Prêmio não encontrado.",
      };
      throw new Error(map[error.message] ?? error.message);
    }
    return { id: redemptionId };
  });
