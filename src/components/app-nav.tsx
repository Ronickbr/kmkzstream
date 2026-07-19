import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Painel" },
  { to: "/indicacoes", label: "Indicações" },
  { to: "/premios", label: "Prêmios" },
  { to: "/planos", label: "Planos" },
  { to: "/suporte", label: "Suporte" },
  { to: "/minha-conta", label: "Minha conta" },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
    <a href="#main" className="skip-link">Pular para o conteúdo</a>
    <nav aria-label="Navegação principal" className="sticky top-0 z-50 border-b border-surface-200 bg-white/80 backdrop-blur-md">

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/dashboard" aria-label="Nexus — painel" className="flex items-center gap-2">
          <span aria-hidden="true" className="size-8 rounded-lg bg-brand" />
          <span className="font-display text-xl font-bold tracking-tight">NEXUS</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active ? "bg-surface-900 text-white" : "text-surface-900/70 hover:bg-surface-100"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                pathname.startsWith("/admin") ? "bg-accent text-accent-foreground" : "text-accent hover:bg-accent/10"
              }`}
            >
              Admin
            </Link>
          )}
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Sair da conta"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-surface-200 px-4 py-1.5 text-sm font-medium hover:bg-surface-100"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </nav>
    </>
  );
}


