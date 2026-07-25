import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentSettings = {
  br_provider: "infinitepay" | "stripe";
  intl_provider: "stripe" | "infinitepay";
  infinitepay: { enabled: boolean; handle: string; redirect_url: string };
  stripe: { enabled: boolean; payment_links: Record<string, string> };
};

export type WhatsappSettings = {
  enabled: boolean;
  days_before: number;
  support_number: string;
  template: string;
};

export const PAYMENTS_DEFAULTS: PaymentSettings = {
  br_provider: "infinitepay",
  intl_provider: "stripe",
  infinitepay: { enabled: true, handle: "", redirect_url: "" },
  stripe: { enabled: true, payment_links: {} },
};

export const WHATSAPP_DEFAULTS: WhatsappSettings = {
  enabled: true,
  days_before: 7,
  support_number: "",
  template:
    "Olá {nome}! Sua assinatura KMKZ ({plano}) vence em {dias} dia(s), no dia {data}. Renove agora e não fique fora do ar: {link}",
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado");
}

/** Configurações de checkout visíveis para qualquer usuário autenticado (sem segredos). */
export const getCheckoutSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("get_checkout_settings");
    if (error) throw new Error(error.message);
    return { ...PAYMENTS_DEFAULTS, ...(data ?? {}) } as PaymentSettings;
  });

export const adminGetPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await (supabase as any).rpc("admin_get_settings", { _key: "payments" });
    if (error) throw new Error(error.message);
    return { ...PAYMENTS_DEFAULTS, ...(data ?? {}) } as PaymentSettings;
  });

export const adminSavePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: PaymentSettings) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).rpc("admin_set_settings", {
      _key: "payments",
      _value: data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetWhatsappSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await (supabase as any).rpc("admin_get_settings", {
      _key: "whatsapp_reminders",
    });
    if (error) throw new Error(error.message);
    return { ...WHATSAPP_DEFAULTS, ...(data ?? {}) } as WhatsappSettings;
  });

export const adminSaveWhatsappSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: WhatsappSettings) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).rpc("admin_set_settings", {
      _key: "whatsapp_reminders",
      _value: data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ExpiringSubscription = {
  subscription_id: string;
  user_id: string;
  display_name: string | null;
  whatsapp: string | null;
  plan_name: string;
  ends_at: string;
  days_left: number;
  reminder_sent_at: string | null;
};

export const adminListExpiring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await (supabase as any).rpc("expiring_subscriptions", { _days: null });
    if (error) throw new Error(error.message);
    return (data ?? []) as ExpiringSubscription[];
  });

export const adminMarkReminderSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { subscriptionId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).rpc("mark_reminder_sent", {
      _subscription_id: data.subscriptionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
