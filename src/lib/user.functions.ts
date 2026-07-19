import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const [profileRes, pointsRes, subRes, refRes, redRes, isAdminRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url, referral_code, whatsapp, phone, bio, city, state, cpf, created_at, onboarded_at").eq("id", userId).maybeSingle(),
      supabase.from("user_points").select("total_points").eq("user_id", userId).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, status, starts_at, ends_at, plan:plans(id, name, period, price_cents)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("referrals")
        .select("id, status, points_awarded, confirmed_at, created_at, referred:profiles!referrals_referred_id_fkey(display_name)")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("reward_redemptions")
        .select("id, status, points_spent, created_at, tracking_code, shipping_recipient, shipping_address, shipping_city, shipping_state, shipping_zip, reward:rewards(name, kind, subscription_months)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    return {
      profile: profileRes.data,
      email: (claims as any)?.email ?? null,
      points: pointsRes.data?.total_points ?? 0,
      subscription: subRes.data,
      referrals: refRes.data ?? [],
      redemptions: redRes.data ?? [],
      isAdmin: Boolean(isAdminRes.data),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    display_name: string;
    avatar_url?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
    bio?: string | null;
    city?: string | null;
    state?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        avatar_url: data.avatar_url ?? null,
        whatsapp: data.whatsapp ?? null,
        phone: data.phone ?? null,
        bio: data.bio ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
