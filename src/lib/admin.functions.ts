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
  .validator((d: {
    id: string;
    name?: string;
    price_cents?: number;
    referral_points?: number;
    purchase_points?: number;
    
    screen_limit?: number;
    quality?: string;
    is_popular?: boolean;
    active?: boolean;
  }) => d)
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
  .validator((d: {
    id?: string;
    name: string;
    description?: string;
    image_url?: string;
    points_cost: number;
    stock: number;
    active: boolean;
    sort_order?: number;
    kind?: "subscription" | "device";
    subscription_months?: number | null;
  }) => d)
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

export const adminGetUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profileRes, pointsRes, rolesRes, subsRes, refsRes, redemptionsRes, authRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabase.from("user_points").select("total_points").eq("user_id", data.userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.userId),
      supabase.from("subscriptions").select("id, status, starts_at, ends_at, plan:plans(name, period)").eq("user_id", data.userId).order("starts_at", { ascending: false }),
      supabase.from("referrals").select("id, status, created_at, points_awarded").eq("referrer_id", data.userId),
      supabase.from("reward_redemptions").select("id, status, points_spent, created_at, reward:rewards(name)").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.getUserById(data.userId),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (!profileRes.data) throw new Error("Usuário não encontrado");

    return {
      profile: profileRes.data,
      email: authRes.data?.user?.email ?? null,
      last_sign_in_at: authRes.data?.user?.last_sign_in_at ?? null,
      total_points: pointsRes.data?.total_points ?? 0,
      roles: (rolesRes.data ?? []).map((r: any) => r.role),
      subscriptions: subsRes.data ?? [],
      referrals: refsRes.data ?? [],
      redemptions: redemptionsRes.data ?? [],
    };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    userId: string;
    display_name?: string;
    whatsapp?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    bio?: string | null;
    total_points?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { userId: targetId, total_points, ...profilePatch } = data;
    const cleanPatch = Object.fromEntries(
      Object.entries(profilePatch).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(cleanPatch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(cleanPatch).eq("id", targetId);
      if (error) throw new Error(error.message);
    }

    if (typeof total_points === "number") {
      if (total_points < 0) throw new Error("Pontos não podem ser negativos");
      const { error } = await supabaseAdmin
        .from("user_points")
        .upsert({ user_id: targetId, total_points }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Você não pode excluir a própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const adminListRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("id, user_id, status, points_spent, created_at, reward:rewards(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    let profileMap = new Map<string, { display_name: string | null }>();
    if (userIds.length) {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (pErr) throw new Error(pErr.message);
      profileMap = new Map((profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name }]));
    }
    return rows.map((r: any) => ({ ...r, user: profileMap.get(r.user_id) ?? null }));
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
