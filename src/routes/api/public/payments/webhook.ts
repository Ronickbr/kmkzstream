import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook de pagamento (InfinityPay / Stripe / manual).
 * Atualiza a assinatura correspondente ao `payment_ref` (order_nsu / client_reference_id),
 * evitando depender apenas do polling do front-end.
 *
 * Segurança:
 *  - assinatura HMAC-SHA256 do corpo cru no header `x-kmkz-signature` (PAYMENT_WEBHOOK_SECRET);
 *  - janela de tempo (anti-replay) via header opcional `x-kmkz-timestamp`;
 *  - idempotência: cada evento é registrado em `payment_webhook_events` e reenvios
 *    do mesmo `event_id`/corpo são ignorados com 200.
 */
const payloadSchema = z.object({
  payment_ref: z.string().min(4).max(200),
  status: z.enum(["confirmed", "paid", "failed", "refused", "refunded", "canceled"]),
  provider: z.enum(["infinitepay", "stripe"]).optional(),
  event_id: z.string().min(1).max(200).optional(),
});

const REPLAY_WINDOW_SECONDS = 300;

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.trim().replace(/^sha256=/, ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handleWebhook(request: Request): Promise<Response> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PAYMENT_WEBHOOK_SECRET não configurado");
    return new Response("Not configured", { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-kmkz-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Anti-replay por timestamp (quando o provedor envia o header)
  const tsHeader = request.headers.get("x-kmkz-timestamp");
  if (tsHeader) {
    const ts = Number(tsHeader);
    const seconds = Number.isFinite(ts) ? (ts > 1e12 ? ts / 1000 : ts) : NaN;
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > REPLAY_WINDOW_SECONDS) {
      return new Response("Stale request", { status: 401 });
    }
  }

  let parsed;
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const eventKey = parsed.event_id
    ? `${parsed.provider ?? "unknown"}:${parsed.event_id}`
    : `hash:${bodyHash}`;

  // Idempotência: a chave única em event_key rejeita duplicatas/replays.
  const { error: dedupeError } = await supabaseAdmin
    .from("payment_webhook_events")
    .insert({
      event_key: eventKey,
      event_id: parsed.event_id ?? null,
      payment_ref: parsed.payment_ref,
      provider: parsed.provider ?? null,
      status: parsed.status,
      body_hash: bodyHash,
      result: "processing",
    } as never);

  if (dedupeError) {
    // 23505 = unique_violation → evento já processado
    if ((dedupeError as { code?: string }).code === "23505") {
      return Response.json({ ok: true, duplicate: true });
    }
    console.error("webhook dedupe error", dedupeError.message);
    return new Response("Dedupe failed", { status: 500 });
  }

  const approved = parsed.status === "confirmed" || parsed.status === "paid";

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

  const finalize = async (result: string) => {
    await supabaseAdmin
      .from("payment_webhook_events")
      .update({ result } as never)
      .eq("event_key", eventKey);
  };

  if (error) {
    console.error("webhook update error", error.message);
    await finalize("error");
    return new Response("Update failed", { status: 500 });
  }
  if (!data) {
    await finalize("unknown_reference");
    return new Response("Unknown reference", { status: 404 });
  }

  await finalize(approved ? "confirmed" : "failed");
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) => handleWebhook(request),
    },
  },
} as never);
