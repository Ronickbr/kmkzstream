import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const subscribeToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId: string; paymentRef?: string; provider?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("id, duration_days, active")
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan || !plan.active) throw new Error("Plano indisponível");

    // Bloqueia contratação enquanto o período pago anterior ainda estiver vigente
    const { data: activePeriod } = await supabase
      .from("subscriptions")
      .select("id, ends_at")
      .eq("user_id", userId)
      .gt("ends_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (activePeriod) {
      throw new Error(
        "Você já possui um período pago em vigor. Aguarde o término antes de contratar novamente."
      );
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + plan.duration_days * 86400_000);

    // Escrita privilegiada: o cliente não pode inserir assinaturas diretamente (RLS bloqueia).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paymentRef =
      typeof data.paymentRef === "string" && /^[A-Za-z0-9._:-]{4,200}$/.test(data.paymentRef)
        ? data.paymentRef
        : null;
    const provider = data.provider === "infinitepay" || data.provider === "stripe" ? data.provider : null;

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        payment_ref: paymentRef,
        payment_provider: provider,
        // Quando há cobrança em gateway, o acesso só é liberado pelo webhook.
        ...(paymentRef
          ? { payment_status: "pending", payment_confirmed_at: null }
          : { payment_status: "confirmed", payment_confirmed_at: startsAt.toISOString() }),
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: (sub as { id: string }).id };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled" } as never)
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Consulta o status atual do pagamento/assinatura do usuário logado. */
export const getMyPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId?: string }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("subscriptions")
      .select("id, plan_id, status, starts_at, ends_at, payment_provider, payment_status, payment_confirmed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.planId) q = q.eq("plan_id", data.planId);

    const { data: sub, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) return { state: "pending" as const, subscription: null };

    const row = sub as typeof sub & { payment_status?: string | null };
    const failed = row.payment_status === "failed" || sub.status === "canceled";
    const confirmed =
      sub.status === "active" &&
      new Date(sub.ends_at) > new Date() &&
      row.payment_status !== "pending" &&
      row.payment_status !== "failed";
    return {
      state: confirmed ? ("confirmed" as const) : failed ? ("failed" as const) : ("pending" as const),
      subscription: sub,
    };
  });
