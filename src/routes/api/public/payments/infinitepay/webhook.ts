import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  applyPaymentResult,
  getInfinitePayHandle,
  hashBody,
  verifyInfinitePayPayment,
} from "@/lib/payments.server";

/**
 * Webhook nativo da InfinityPay (InfinitePay Checkout).
 *
 * A InfinitePay não assina o corpo da requisição; a validação correta e
 * recomendada por eles é reconsultar a transação na API pública
 * (`payment_check`) antes de conceder acesso. Por isso, aqui:
 *  1. validamos os campos obrigatórios do payload;
 *  2. conferimos que o `handle` bate com o configurado no admin;
 *  3. reconsultamos a transação na InfinityPay (verificação de assinatura/autenticidade);
 *  4. conferimos o valor pago contra o preço do plano;
 *  5. só então confirmamos a assinatura (idempotente por `transaction_nsu`).
 */
const payloadSchema = z.object({
  invoice_slug: z.string().min(1).max(200).optional(),
  amount: z.coerce.number().int().nonnegative().optional(),
  paid_amount: z.coerce.number().int().nonnegative().optional(),
  installments: z.coerce.number().int().optional(),
  capture_method: z.string().max(50).optional(),
  transaction_nsu: z.string().min(1).max(200),
  order_nsu: z.string().min(4).max(200),
  receipt_url: z.string().url().max(500).optional(),
  handle: z.string().max(100).optional(),
});

async function handleWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const handle = await getInfinitePayHandle();
  if (!handle) {
    console.error("InfinityPay handle não configurado");
    return new Response("Not configured", { status: 503 });
  }
  if (parsed.handle && parsed.handle.trim().replace(/^@/, "") !== handle) {
    return new Response("Handle mismatch", { status: 401 });
  }

  // Verificação de autenticidade junto à InfinityPay.
  const check = await verifyInfinitePayPayment({
    handle,
    transactionNsu: parsed.transaction_nsu,
    orderNsu: parsed.order_nsu,
    slug: parsed.invoice_slug ?? null,
  });
  if (!check.ok) {
    console.warn("InfinityPay payment_check negou o pagamento", parsed.order_nsu, check.detail);
    return new Response("Payment not verified", { status: 401 });
  }

  // Confere o valor pago contra o preço do plano da assinatura.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plans:plan_id(price_cents)")
    .eq("payment_ref", parsed.order_nsu)
    .maybeSingle();

  if (!sub) return new Response("Unknown reference", { status: 404 });

  const expected = (sub as { plans?: { price_cents?: number } | null }).plans?.price_cents ?? null;
  const paid = parsed.paid_amount ?? parsed.amount ?? null;
  if (expected != null && paid != null && paid < expected) {
    console.warn("InfinityPay valor pago menor que o plano", parsed.order_nsu, paid, expected);
    return new Response("Amount mismatch", { status: 400 });
  }

  const result = await applyPaymentResult({
    paymentRef: parsed.order_nsu,
    outcome: "approved",
    provider: "infinitepay",
    eventId: parsed.transaction_nsu,
    bodyHash: hashBody(rawBody),
    status: "paid",
  });

  return Response.json(result.body, { status: result.status });
}

export const Route = createFileRoute("/api/public/payments/infinitepay/webhook")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) => handleWebhook(request),
    },
  },
} as never);
