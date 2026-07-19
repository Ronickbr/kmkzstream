import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/admin", label: "Visão geral", exact: true },
  { to: "/admin/planos", label: "Planos" },
  { to: "/admin/premios", label: "Prêmios" },
  { to: "/admin/usuarios", label: "Usuários" },
  { to: "/admin/resgates", label: "Resgates" },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Navegação do admin" className="border-b border-surface-200 bg-card">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-3">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active ? "bg-surface-900 text-white" : "text-surface-900/70 hover:bg-surface-100"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

