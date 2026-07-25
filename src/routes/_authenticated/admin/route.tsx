import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { overviewQueryOptions as overviewQO } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(overviewQO);
    if (!data.isAdmin) throw redirect({ to: "/dashboard" });
    return data;
  },
  component: () => <Outlet />,
});
