import { createFileRoute } from "@tanstack/react-router";
import {
  applyPaymentResult,
  getInfinitePayHandle,
  hashBody,
  verifyInfinitePayPayment,
} from "@/lib/payments.server";

/**
 * Retorno (redirect/callback) da InfinityPay.
 * O cliente volta do checkout da InfinityPay para cá; verificamos o pagamento
 * na API pública deles, atualizamos a assinatura e devolvemos o usuário ao
 * checkout do app com o status já resolvido.
 *
 * URL usada como `redirect_url`:
 *   /api/public/payments/infinitepay/retorno?plan=<planId>
 */
function safePlanPath(origin: string, plan: string | null, state: string) {
  const planId = plan && /^[a-zA-Z0-9-]{1,64}$/.test(plan) ? plan : null;
  const path = planId ? `/checkout/${planId}` : "/planos";
  return `${origin}${path}?pay=${state}`;
}

async function handleReturn(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const plan = url.searchParams.get("plan");
  const orderNsu = url.searchParams.get("order_nsu");
  const transactionNsu = url.searchParams.get("transaction_nsu");
  const slug = url.searchParams.get("slug");

  const redirectTo = (state: string) =>
    new Response(null, { status: 302, headers: { Location: safePlanPath(origin, plan, state) } });

  // Campos obrigatórios ausentes → volta como pendente (o polling/realtime assume).
  if (!orderNsu || !transactionNsu) return redirectTo("pending");

  const handle = await getInfinitePayHandle();
  if (!handle) return redirectTo("pending");

  const check = await verifyInfinitePayPayment({
    handle,
    transactionNsu,
    orderNsu,
    slug,
  });
  if (!check.ok) return redirectTo("failed");

  const result = await applyPaymentResult({
    paymentRef: orderNsu,
    outcome: "approved",
    provider: "infinitepay",
    eventId: transactionNsu,
    bodyHash: hashBody(`${orderNsu}:${transactionNsu}`),
    status: "paid",
  });

  return redirectTo(result.status === 200 ? "ok" : "pending");
}

export const Route = createFileRoute("/api/public/payments/infinitepay/retorno")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleReturn(request),
    },
  },
} as never);
