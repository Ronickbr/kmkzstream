import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/user.functions";
import { plansQueryOptions } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

const searchSchema = z.object({
  plan: z.string().optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQueryOptions),
  head: () => ({
    meta: [
      { title: "Criar conta — KMKZ Streaming" },
      { name: "description", content: "Crie sua conta KMKZ Streaming e ative o plano escolhido em poucos minutos." },
      { property: "og:title", content: "Criar conta — KMKZ Streaming" },
      { property: "og:description", content: "Cadastro rápido para assinar seu plano KMKZ Streaming." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroPage,
});

const onlyDigits = (v: string) => v.replace(/\D/g, "");

function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function CadastroPage() {
  const { tc, planPrice } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: plans } = useSuspenseQuery(plansQueryOptions);

  const [planId, setPlanId] = useState<string>(search.plan ?? plans[0]?.id ?? "");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [refCode, setRefCode] = useState(search.ref ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const ids = {
    plan: useId(),
    name: useId(),
    cpf: useId(),
    whats: useId(),
    ref: useId(),
    email: useId(),
    pass: useId(),
  };

  useEffect(() => {
    if (search.ref) {
      localStorage.setItem("nexus_ref", search.ref);
      setRefCode(search.ref);
    } else {
      const stored = localStorage.getItem("nexus_ref");
      if (stored) setRefCode(stored);
    }
  }, [search.ref]);

  const selected = plans.find((p) => p.id === planId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) return toast.error("Selecione um plano");
    if (name.trim().length < 2) return toast.error("Informe seu nome completo");
    if (onlyDigits(cpf).length !== 11) return toast.error("CPF inválido — informe 11 dígitos");
    if (onlyDigits(whatsapp).length < 10) return toast.error("WhatsApp inválido — informe DDD + número");
    if (password.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres");

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: name.trim(),
            referral_code: refCode.trim() || undefined,
          },
        },
      });
      if (error) throw error;
      localStorage.removeItem("nexus_ref");

      if (data.session) {
        try {
          await updateMyProfile({
            data: {
              display_name: name.trim(),
              whatsapp: onlyDigits(whatsapp),
              cpf: onlyDigits(cpf),
            },
          });
        } catch (err: any) {
          toast.error(err?.message ?? "Não foi possível salvar seus dados");
        }
        toast.success("Conta criada! Vamos ao pagamento.");
        navigate({ to: "/checkout/$planId", params: { planId }, replace: true });
      } else {
        toast.success("Conta criada! Confirme seu e-mail para continuar.");
        navigate({ to: "/auth", search: { mode: "signin", redirect: `/checkout/${planId}` }, replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível criar sua conta");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-sm border border-white/15 bg-white/[0.04] px-4 py-3 font-body-b text-[14px] text-white placeholder:text-white/35 focus-visible:border-[color:var(--color-tally)] focus-visible:outline-none";
  const label = "mb-1.5 block font-mono-b text-[10px] font-bold uppercase tracking-[0.2em] text-white/50";

  return (
    <div className="min-h-dvh bg-[#0a0a0c] px-4 py-10 sm:py-16">
      <a href="#cadastro-main" className="skip-link">Ir para o conteúdo</a>
      <main id="cadastro-main" className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="size-7 rounded-sm bg-[color:var(--color-tally)]" />
            <span className="font-broadcast text-lg text-white">KMKZ Streaming</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 sm:p-8">
          <h1 className="font-broadcast text-3xl text-white sm:text-4xl">Criar conta</h1>
          <p className="mt-2 font-body-b text-[14px] text-white/60">
            Preencha seus dados para ativar o plano escolhido.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor={ids.plan} className={label}>Plano selecionado</label>
              <select
                id={ids.plan}
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className={field}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0a0a0c]">
                    {tc(p.name)} — {planPrice(p)}
                  </option>
                ))}
              </select>
              {selected && (
                <p className="mt-2 font-mono-b text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {selected.quality ?? "HD"} · {selected.screen_limit ?? 1} tela(s) · {planPrice(selected)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={ids.name} className={label}>Nome completo</label>
              <input id={ids.name} className={field} autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={ids.cpf} className={label}>CPF</label>
                <input id={ids.cpf} className={field} inputMode="numeric" value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" required />
              </div>
              <div>
                <label htmlFor={ids.whats} className={label}>WhatsApp</label>
                <input id={ids.whats} className={field} inputMode="tel" autoComplete="tel" value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" required />
              </div>
            </div>

            <div>
              <label htmlFor={ids.ref} className={label}>Código de indicação (opcional)</label>
              <input id={ids.ref} className={field} value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="Ex.: KMKZ1234" />
            </div>

            <div>
              <label htmlFor={ids.email} className={label}>Usuário (e-mail)</label>
              <input id={ids.email} className={field} type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
            </div>

            <div>
              <label htmlFor={ids.pass} className={label}>Senha</label>
              <input id={ids.pass} className={field} type="password" autoComplete="new-password" minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[color:var(--color-tally)] px-5 py-3 font-mono-b text-[11px] font-bold uppercase tracking-[0.22em] text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Criar conta e continuar
            </button>
          </form>

          <p className="mt-6 text-center font-body-b text-[13px] text-white/60">
            Já tem conta?{" "}
            <Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-white underline-offset-2 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
