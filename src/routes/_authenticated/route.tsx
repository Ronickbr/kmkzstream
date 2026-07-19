import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getMyOverview } from "@/lib/user.functions";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";

const overviewQO = queryOptions({ queryKey: ["me", "overview"], queryFn: () => getMyOverview() });

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  loader: async ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <SidebarProvider>
      <a href="#main" className="skip-link">Pular para o conteúdo</a>
      <AppSidebar isAdmin={data.isAdmin} />
      <SidebarInset className="bg-surface-50">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-surface-200 bg-white/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label="Alternar menu lateral" />
            <span className="text-sm font-medium text-surface-900/70">
              {data.isAdmin ? "Painel Nexus" : "Sua conta"}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sair da conta"
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-surface-200 px-3 py-1.5 text-sm font-medium hover:bg-surface-100"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
