import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShippingInput = {
  recipient: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  notes?: string;
};

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { rewardId: string; shipping?: ShippingInput }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: redemptionId, error } = await supabase.rpc("redeem_reward", {
      _reward_id: data.rewardId,
      _shipping: (data.shipping as unknown as Record<string, unknown>) ?? null,
    });
    if (error) {
      const map: Record<string, string> = {
        insufficient_points: "Pontos insuficientes para este resgate.",
        reward_out_of_stock: "Prêmio esgotado.",
        reward_inactive: "Prêmio indisponível.",
        reward_not_found: "Prêmio não encontrado.",
        shipping_required: "Informe o endereço de entrega para este prêmio.",
        not_authenticated: "Sessão expirada. Entre novamente.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      throw new Error(key ? map[key] : error.message);
    }
    return { id: redemptionId };
  });
