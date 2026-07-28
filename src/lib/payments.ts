/**
 * Roteamento de gateway de pagamento.
 * Brasil (pt/BRL) → InfinityPay · Demais países (en/es/USD) → Stripe.
 */
import type { PaymentSettings } from "@/lib/settings.functions";

export type Gateway = "infinitepay" | "stripe";

export const GATEWAY_LABEL: Record<Gateway, string> = {
  infinitepay: "InfinityPay",
  stripe: "Stripe",
};

/** Define o gateway conforme o idioma/moeda ativa e as configurações do admin. */
export function gatewayForLocale(locale: string, settings?: PaymentSettings | null): Gateway {
  const isBR = locale === "pt";
  const preferred = (isBR ? settings?.br_provider : settings?.intl_provider) ?? (isBR ? "infinitepay" : "stripe");
  const enabled = (g: Gateway) => (g === "infinitepay" ? settings?.infinitepay?.enabled : settings?.stripe?.enabled);
  if (enabled(preferred as Gateway) !== false) return preferred as Gateway;
  const fallback: Gateway = preferred === "stripe" ? "infinitepay" : "stripe";
  return enabled(fallback) !== false ? fallback : (preferred as Gateway);
}

/**
 * Link de checkout da InfinityPay (InfinitePay).
 * Preço sempre em centavos de real.
 */
export function buildInfinitePayUrl(opts: {
  handle: string;
  planName: string;
  priceCents: number;
  orderRef: string;
  redirectUrl?: string;
}): string | null {
  const handle = opts.handle?.trim().replace(/^@/, "");
  if (!handle) return null;
  const items = encodeURIComponent(
    JSON.stringify([{ name: `Plano ${opts.planName}`, price: opts.priceCents, quantity: 1 }]),
  );
  const params = [`items=${items}`, `order_nsu=${encodeURIComponent(opts.orderRef)}`];
  if (opts.redirectUrl) params.push(`redirect_url=${encodeURIComponent(opts.redirectUrl)}`);
  return `https://checkout.infinitepay.io/${handle}?${params.join("&")}`;
}

/** Payment Link do Stripe configurado por plano no painel admin. */
export function stripeLinkForPlan(settings: PaymentSettings | null | undefined, planId: string): string | null {
  const link = settings?.stripe?.payment_links?.[planId];
  return link && link.trim().length > 0 ? link.trim() : null;
}

/** Monta a URL final do gateway escolhido (ou null se ainda não configurado). */
export function checkoutUrl(opts: {
  gateway: Gateway;
  settings: PaymentSettings | null | undefined;
  planId: string;
  planName: string;
  priceCentsBRL: number;
  orderRef: string;
  /** Usado quando o admin não configurou uma URL de retorno. */
  fallbackRedirectUrl?: string;
}): string | null {
  if (opts.gateway === "stripe") return stripeLinkForPlan(opts.settings, opts.planId);
  return buildInfinitePayUrl({
    handle: opts.settings?.infinitepay?.handle ?? "",
    planName: opts.planName,
    priceCents: opts.priceCentsBRL,
    orderRef: opts.orderRef,
    redirectUrl: opts.settings?.infinitepay?.redirect_url || opts.fallbackRedirectUrl || undefined,
  });
}

/** Monta o link wa.me com a mensagem de aviso de vencimento. */
export function whatsappReminderLink(opts: {
  phone: string | null | undefined;
  template: string;
  name: string;
  plan: string;
  daysLeft: number;
  endsAt: string;
  renewUrl: string;
}): string | null {
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const date = new Date(opts.endsAt).toLocaleDateString("pt-BR");
  const msg = opts.template
    .replaceAll("{nome}", opts.name || "assinante")
    .replaceAll("{plano}", opts.plan)
    .replaceAll("{dias}", String(opts.daysLeft))
    .replaceAll("{data}", date)
    .replaceAll("{link}", opts.renewUrl);
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`;
}
