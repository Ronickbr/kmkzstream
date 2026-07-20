import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const subscribeToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planId: string }) => data)
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

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: sub.id };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
