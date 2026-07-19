import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function makePublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listActivePlans = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = makePublicClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, period, price_cents, duration_days, referral_points, purchase_points, features, sort_order, screen_limit, quality, is_popular")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listActiveRewards = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = makePublicClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("id, name, description, image_url, points_cost, stock, sort_order, kind, subscription_months")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});
