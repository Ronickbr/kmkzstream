import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Gift,
  CreditCard,
  LifeBuoy,
  UserCircle,
  ShieldCheck,
  Package,
  Ticket,
  BarChart3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const userItems = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/indicacoes", label: "Indicações", icon: Users },
  { to: "/premios", label: "Prêmios", icon: Gift },
  { to: "/planos", label: "Planos", icon: CreditCard },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/minha-conta", label: "Minha conta", icon: UserCircle },
];

const adminItems = [
  { to: "/admin", label: "Visão geral", icon: BarChart3, exact: true },
  { to: "/admin/planos", label: "Planos", icon: CreditCard },
  { to: "/admin/premios", label: "Prêmios", icon: Gift },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/resgates", label: "Resgates", icon: Package },
  { to: "/admin/resgates", label: "Resgates", icon: Ticket, hidden: true },
];

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-surface-200">
        <Link to="/dashboard" aria-label="Nexus — painel" className="flex items-center gap-2 px-2 py-1">
          <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-brand" />
          {!collapsed && <span className="font-display text-lg font-bold tracking-tight">NEXUS</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userItems.map((it) => {
                const active = isActive(it.to);
                return (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                      <Link to={it.to} aria-current={active ? "page" : undefined}>
                        <it.icon aria-hidden="true" />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems
                  .filter((i) => !i.hidden)
                  .map((it) => {
                    const active = isActive(it.to, it.exact);
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                          <Link to={it.to} aria-current={active ? "page" : undefined}>
                            <it.icon aria-hidden="true" />
                            <span>{it.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
