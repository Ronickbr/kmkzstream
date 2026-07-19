import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_stats");
    if (error) throw new Error(error.message);
    return data as {
      total_users: number;
      active_subscriptions: number;
      total_revenue_cents: number;
      confirmed_referrals: number;
      pending_redemptions: number;
    };
  });

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; name?: string; price_cents?: number; referral_points?: number; active?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("plans").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("rewards").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id?: string; name: string; description?: string; image_url?: string; points_cost: number; stock: number; active: boolean; sort_order?: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await supabase.from("rewards").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("rewards").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("rewards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, display_name, referral_code, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const [pointsRes, rolesRes, subsRes, refsRes] = await Promise.all([
      supabase.from("user_points").select("user_id, total_points").in("user_id", ids),
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase.from("subscriptions").select("user_id, status, plan:plans(name)").in("user_id", ids).eq("status", "active"),
      supabase.from("referrals").select("referrer_id, status").in("referrer_id", ids),
    ]);

    const pointsMap = new Map((pointsRes.data ?? []).map((p) => [p.user_id, p.total_points]));
    const rolesMap = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    const subMap = new Map((subsRes.data ?? []).map((s) => [s.user_id, (s.plan as any)?.name ?? null]));
    const refCount = new Map<string, { total: number; confirmed: number }>();
    (refsRes.data ?? []).forEach((r) => {
      const c = refCount.get(r.referrer_id) ?? { total: 0, confirmed: 0 };
      c.total += 1;
      if (r.status === "confirmed") c.confirmed += 1;
      refCount.set(r.referrer_id, c);
    });

    return (profiles ?? []).map((p) => ({
      ...p,
      points: pointsMap.get(p.id) ?? 0,
      roles: rolesMap.get(p.id) ?? ["user"],
      active_plan: subMap.get(p.id) ?? null,
      referrals_total: refCount.get(p.id)?.total ?? 0,
      referrals_confirmed: refCount.get(p.id)?.confirmed ?? 0,
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; makeAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminListRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("id, status, points_spent, created_at, user:profiles(display_name), reward:rewards(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdateRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; status: "pending" | "delivered" | "canceled" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Point Rules ============

export type PointRule = {
  id: string;
  name: string;
  points: number;
  daily_limit: number | null;
  active: boolean;
  updated_at: string;
};

export const adminListPointRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("point_rules").select("*").order("id");
    if (error) throw new Error(error.message);
    return (data ?? []) as PointRule[];
  });

export const adminUpsertPointRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; name: string; points: number; daily_limit: number | null; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!/^[a-z0-9_]+$/.test(data.id)) throw new Error("ID deve conter apenas letras minúsculas, números e _");
    if (data.points < 0) throw new Error("Pontos não podem ser negativos");
    const payload = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("point_rules").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePointRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const reserved = ["share", "referral_confirmed", "reward_redeemed"];
    if (reserved.includes(data.id)) throw new Error("Regra do sistema não pode ser removida");
    const { error } = await supabase.from("point_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_analytics");
    if (error) throw new Error(error.message);
    return data as {
      plan_distribution: { name: string; period: string; count: number }[];
      top_users: { display_name: string; total_points: number; referrals: number }[];
      referral_funnel: { total: number; pending: number; confirmed: number; conversion_rate: number };
      redemption_funnel: { pending: number; fulfilled: number; cancelled: number; points_spent: number };
      daily_signups: { day: string; signups: number }[];
      active_users_30d: number;
    };
  });
