import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function SiteNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">Pular para o conteúdo</a>
      <nav aria-label="Navegação principal" className="sticky top-0 z-50 border-b border-surface-200 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" aria-label="Nexus — página inicial" className="flex items-center gap-2">
            <span aria-hidden="true" className="size-8 rounded-lg bg-brand" />
            <span className="font-display text-xl font-bold tracking-tight">NEXUS</span>
          </Link>
          <div className="hidden gap-8 text-sm font-medium md:flex">
            <Link to="/" hash="planos" className="text-surface-900/70 hover:text-brand">Planos</Link>
            <Link to="/" hash="premios" className="text-surface-900/70 hover:text-brand">Prêmios</Link>
            <Link to="/" hash="como-funciona" className="text-surface-900/70 hover:text-brand">Como funciona</Link>
            <a href="mailto:suporte@nexus.app" className="text-surface-900/70 hover:text-brand">Suporte</a>
          </div>
          <div className="flex items-center gap-4">
            {signedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
              >
                Meu Painel
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-semibold">Entrar</Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
                >
                  Começar agora
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}


export function SiteFooter() {
  return (
    <footer className="border-t border-surface-200 bg-card py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-brand" />
          <span className="font-display text-lg font-bold tracking-tight">NEXUS</span>
        </div>
        <p className="text-sm text-surface-900/40">© {new Date().getFullYear()} Nexus. Todos os direitos reservados.</p>
        <div className="flex gap-6 text-sm font-medium text-surface-900/60">
          <a href="#" className="hover:text-brand">Termos</a>
          <a href="#" className="hover:text-brand">Privacidade</a>
          <a href="mailto:suporte@nexus.app" className="hover:text-brand">Suporte</a>
        </div>
      </div>
    </footer>
  );
}
