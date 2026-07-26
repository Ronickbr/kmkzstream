import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/),
});

/**
 * Valida se um código de indicação existe. Executado no servidor para que o
 * RPC `referral_code_exists` não precise ficar exposto ao papel `anon`.
 * Retorna apenas um booleano — nenhum dado do indicador é exposto.
 */
export const checkReferralCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists, error } = await supabaseAdmin.rpc("referral_code_exists", {
      _code: data.code,
    });
    if (error) {
      console.error("[checkReferralCode]", error.message);
      throw new Error("Não foi possível validar o código agora.");
    }
    return { exists: Boolean(exists) };
  });
