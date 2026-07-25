import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  ref: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar — KMKZ Streaming" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function safeRedirect(path?: string): string {
  if (!path) return "/dashboard";
  // only allow same-origin absolute paths, block protocol-relative and external URLs
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/dashboard";
  return path;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const redirectTo = safeRedirect(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState(search.ref ?? "");
  const [loading, setLoading] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    if (search.ref) {
      localStorage.setItem("nexus_ref", search.ref);
      setRefCode(search.ref);
    } else {
      const stored = localStorage.getItem("nexus_ref");
      if (stored) setRefCode(stored);
    }
  }, [search.ref]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTo, replace: true });
    });
  }, [navigate, search.redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: name || email.split("@")[0],
              referral_code: refCode || undefined,
            },
          },
        });
        if (error) throw error;
        localStorage.removeItem("nexus_ref");
        toast.success("Conta criada! Bem-vindo.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado");
      }
      navigate({ to: redirectTo, replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: redirectTo, replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro no login com Google");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 px-4 py-12">
      <a href="#auth-main" className="skip-link">Pular para o conteúdo</a>
      <main id="auth-main" className="w-full max-w-md">
        <Link to="/" aria-label="KMKZ Streaming — página inicial" className="mb-8 flex items-center justify-center gap-2">
          <span aria-hidden="true" className="size-8 rounded-lg bg-brand" />
          <span className="font-display text-xl font-bold tracking-tight">KMKZ Streaming</span>
        </Link>
        <div className="rounded-3xl border border-surface-200 bg-card p-5 shadow-xl sm:p-8">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-surface-900/70">
            {mode === "signup"
              ? "Comece a acumular pontos por indicação hoje."
              : "Bem-vindo de volta ao seu painel."}
          </p>

          {refCode && mode === "signup" && (
            <div className="mt-4 rounded-xl bg-accent/10 px-4 py-2 text-xs font-semibold text-accent-foreground">
              Indicado por: <span className="font-mono">{refCode}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label htmlFor={nameId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-surface-900/70">Nome</label>
                <input
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <label htmlFor={emailId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-surface-900/70">Email</label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus-visible:border-brand"
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-surface-900/70">Senha</label>
              <input
                id={passwordId}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                aria-required="true"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus-visible:border-brand"
                placeholder="Mínimo de 6 caracteres"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {mode === "signup" ? "Criar conta" : "Entrar"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-surface-900/60" aria-hidden="true">
            <div className="h-px flex-1 bg-surface-200" />
            OU
            <div className="h-px flex-1 bg-surface-200" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            aria-busy={loading}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-surface-200 py-3 text-sm font-semibold hover:bg-surface-50 disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continuar com Google
          </button>

          <div className="mt-6 text-center text-sm text-surface-900/70">
            {mode === "signup" ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-bold text-brand underline-offset-2 hover:underline"
            >
              {mode === "signup" ? "Entrar" : "Criar conta"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
