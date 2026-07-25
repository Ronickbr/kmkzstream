import { createFileRoute } from "@tanstack/react-router";
import type { RouteServerOptions } from "@tanstack/start-client-core";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook de pagamento (InfinityPay / Stripe / manual).
 * Atualiza a assinatura correspondente ao `payment_ref` (order_nsu / client_reference_id),
 * evitando depender apenas do polling do front-end.
 *
 * Segurança: assinatura HMAC-SHA256 do corpo cru no header `x-kmkz-signature`,
 * usando o segredo PAYMENT_WEBHOOK_SECRET.
 */
const payloadSchema = z.object({
  payment_ref: z.string().min(4).max(200),
  status: z.enum(["confirmed", "paid", "failed", "refused", "refunded", "canceled"]),
  provider: z.enum(["infinitepay", "stripe"]).optional(),
});

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.trim().replace(/^sha256=/, ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (!secret) {
          console.error("PAYMENT_WEBHOOK_SECRET não configurado");
          return new Response("Not configured", { status: 503 });
        }

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-kmkz-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = payloadSchema.parse(JSON.parse(rawBody));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const approved = parsed.status === "confirmed" || parsed.status === "paid";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const patch: Record<string, unknown> = approved
          ? {
              payment_status: "confirmed",
              payment_confirmed_at: new Date().toISOString(),
              status: "active",
            }
          : {
              payment_status: "failed",
              payment_confirmed_at: null,
              status: "canceled",
            };
        if (parsed.provider) patch.payment_provider = parsed.provider;

        const { data, error } = await supabaseAdmin
          .from("subscriptions")
          .update(patch as never)
          .eq("payment_ref", parsed.payment_ref)
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("webhook update error", error.message);
          return new Response("Update failed", { status: 500 });
        }
        if (!data) return new Response("Unknown reference", { status: 404 });

        return Response.json({ ok: true });
      },
    },
  },
});
