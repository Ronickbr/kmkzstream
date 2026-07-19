import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getMyOverview } from "@/lib/user.functions";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
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
      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger aria-label="Alternar menu lateral" className="text-muted-foreground hover:text-foreground" />
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-muted-foreground">
              {data.isAdmin ? "Painel Nexus · Administração" : "Área do usuário"}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sair da conta"
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:border-brand/50 hover:bg-card hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </header>
        <div className="animate-rise-in">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
