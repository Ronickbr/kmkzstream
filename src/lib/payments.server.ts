/**
 * Lógica server-only de confirmação de pagamento.
 * Compartilhada entre o webhook genérico, o webhook da InfinityPay e o
 * endpoint de retorno (redirect) da InfinityPay.
 */
import { createHash } from "crypto";

export type PaymentOutcome = "approved" | "chargeback" | "failed";

const APPROVED = new Set(["confirmed", "paid", "succeeded", "approved"]);
const CHARGEBACK = new Set(["chargeback", "disputed"]);

export function outcomeFromStatus(status: string): PaymentOutcome {
  const s = status.toLowerCase();
  if (APPROVED.has(s)) return "approved";
  if (CHARGEBACK.has(s)) return "chargeback";
  return "failed";
}

export function hashBody(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Handle configurado da InfinityPay (sem "@"). */
export async function getInfinitePayHandle(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "payments")
    .maybeSingle();
  const value = (data?.value ?? null) as { infinitepay?: { handle?: string } } | null;
  const handle = value?.infinitepay?.handle?.trim().replace(/^@/, "");
  return handle && handle.length > 0 ? handle : null;
}

/**
 * Verificação oficial da InfinityPay: a InfinitePay não assina o corpo do webhook,
 * a validação correta é reconsultar a transação na API pública deles.
 * Retorna `true` somente quando a API confirma o pagamento.
 */
export async function verifyInfinitePayPayment(params: {
  handle: string;
  transactionNsu: string;
  orderNsu: string;
  slug?: string | null;
}): Promise<{ ok: boolean; detail?: string }> {
  const url = new URL("https://api.infinitepay.io/invoices/public/checkout/payment_check");
  url.searchParams.set("handle", params.handle);
  url.searchParams.set("transaction_nsu", params.transactionNsu);
  url.searchParams.set("external_order_nsu", params.orderNsu);
  if (params.slug) url.searchParams.set("slug", params.slug);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ok: false, detail: `http_${res.status}` };
    const json = (await res.json()) as { success?: boolean; paid?: boolean; message?: string };
    const paid = json.paid === true || json.success === true;
    return { ok: paid, detail: json.message };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "fetch_error" };
  }
}

/**
 * Aplica o resultado do pagamento na assinatura correspondente ao `payment_ref`,
 * de forma idempotente (tabela `payment_webhook_events`).
 */
export async function applyPaymentResult(input: {
  paymentRef: string;
  outcome: PaymentOutcome;
  provider: string;
  eventId?: string | null;
  bodyHash: string;
  status: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const eventKey = input.eventId
    ? `${input.provider}:${input.eventId}`
    : `hash:${input.bodyHash}`;

  const { error: dedupeError } = await supabaseAdmin.from("payment_webhook_events").insert({
    event_key: eventKey,
    event_id: input.eventId ?? null,
    payment_ref: input.paymentRef,
    provider: input.provider,
    status: input.status,
    body_hash: input.bodyHash,
    result: "processing",
  } as never);

  if (dedupeError) {
    if ((dedupeError as { code?: string }).code === "23505") {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    console.error("webhook dedupe error", dedupeError.message);
    return { status: 500, body: { ok: false, error: "dedupe_failed" } };
  }

  const patch: Record<string, unknown> =
    input.outcome === "approved"
      ? {
          payment_status: "confirmed",
          payment_confirmed_at: new Date().toISOString(),
          status: "active",
        }
      : input.outcome === "chargeback"
        ? { payment_status: "chargeback", payment_confirmed_at: null, status: "canceled" }
        : { payment_status: "failed", payment_confirmed_at: null, status: "canceled" };

  patch.payment_provider = input.provider;

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update(patch as never)
    .eq("payment_ref", input.paymentRef)
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
    return { status: 500, body: { ok: false, error: "update_failed" } };
  }
  if (!data) {
    await finalize("unknown_reference");
    return { status: 404, body: { ok: false, error: "unknown_reference" } };
  }

  await finalize(input.outcome === "approved" ? "confirmed" : input.outcome);
  return { status: 200, body: { ok: true, outcome: input.outcome } };
}
