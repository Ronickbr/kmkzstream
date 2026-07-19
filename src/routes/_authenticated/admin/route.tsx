import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyOverview } from "@/lib/user.functions";
import { queryOptions } from "@tanstack/react-query";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(overviewQO);
    if (!data.isAdmin) throw redirect({ to: "/dashboard" });
    return data;
  },
  component: () => <Outlet />,
});
