import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check, X, AlertCircle } from "lucide-react";
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

/** Valida CPF pelos dígitos verificadores. */
function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Valida número de WhatsApp brasileiro (DDD + 8/9 dígitos). */
function validateWhats(value: string): "ok" | "digits" | "ddd" | "mobile" {
  const d = onlyDigits(value);
  if (d.length < 10 || d.length > 11) return "digits";
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return "ddd";
  if (d.length === 11 && d[2] !== "9") return "mobile";
  return "ok";
}

type PwdChecks = { len: boolean; caseMix: boolean; num: boolean; sym: boolean };

function checkPassword(v: string): PwdChecks {
  return {
    len: v.length >= 8,
    caseMix: /[a-z]/.test(v) && /[A-Z]/.test(v),
    num: /\d/.test(v),
    sym: /[^A-Za-z0-9]/.test(v),
  };
}

function CadastroPage() {
  const { t, tc, planPrice } = useI18n();
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
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [refStatus, setRefStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const ids = {
    plan: useId(),
    name: useId(),
    cpf: useId(),
    whats: useId(),
    ref: useId(),
    email: useId(),
    pass: useId(),
    pass2: useId(),
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

  // Valida o código de indicação (opcional) contra a base, com debounce.
  useEffect(() => {
    const code = refCode.trim();
    if (!code) {
      setRefStatus("idle");
      return;
    }
    setRefStatus("checking");
    let active = true;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("referral_code_exists", { _code: code });
      if (!active) return;
      setRefStatus(error ? "idle" : data ? "valid" : "invalid");
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refCode]);

  const pwd = checkPassword(password);
  const pwdScore = Number(pwd.len) + Number(pwd.caseMix) + Number(pwd.num) + Number(pwd.sym);
  const pwdOk = pwd.len && pwd.caseMix && (pwd.num || pwd.sym);
  const confirmOk = password2.length > 0 && password === password2;
  const canSubmit =
    !loading && pwdOk && confirmOk && refStatus !== "invalid" && refStatus !== "checking";

  const selected = plans.find((p) => p.id === planId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) return toast.error(t("signup.errPlan"));
    if (name.trim().length < 2) return toast.error(t("signup.errName"));
    if (onlyDigits(cpf).length !== 11) return toast.error(t("signup.errCpfDigits"));
    if (!isValidCpf(cpf)) return toast.error(t("signup.errCpfInvalid"));
    const whatsCheck = validateWhats(whatsapp);
    if (whatsCheck === "digits") return toast.error(t("signup.errWhatsDigits"));
    if (whatsCheck === "ddd") return toast.error(t("signup.errWhatsDdd"));
    if (whatsCheck === "mobile") return toast.error(t("signup.errWhatsMobile"));
    if (!pwd.len) return toast.error(t("signup.errPassword"));
    if (!pwdOk) return toast.error(t("signup.errPasswordWeak"));
    if (!confirmOk) return toast.error(t("signup.errConfirm"));
    if (refStatus === "invalid") return toast.error(t("signup.errRef"));

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: name.trim(),
            referral_code: refStatus === "valid" ? refCode.trim() : undefined,
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
          toast.error(err?.message ?? t("signup.errProfile"));
        }
        toast.success(t("signup.okPay"));
        navigate({ to: "/checkout/$planId", params: { planId }, replace: true });
      } else {
        toast.success(t("signup.okConfirm"));
        navigate({ to: "/auth", search: { mode: "signin", redirect: `/checkout/${planId}` }, replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? t("signup.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-sm border border-white/15 bg-white/[0.04] px-4 py-3 font-body-b text-[14px] text-white placeholder:text-white/35 focus-visible:border-[color:var(--color-tally)] focus-visible:outline-none";
  const label = "mb-1.5 block font-mono-b text-[10px] font-bold uppercase tracking-[0.2em] text-white/50";

  return (
    <div className="min-h-dvh bg-[#0a0a0c] px-4 py-10 sm:py-16">
      <a href="#cadastro-main" className="skip-link">{t("common.skip")}</a>
      <main id="cadastro-main" className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="size-7 rounded-sm bg-[color:var(--color-tally)]" />
            <span className="font-broadcast text-lg text-white">KMKZ Streaming</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 sm:p-8">
          <h1 className="font-broadcast text-3xl text-white sm:text-4xl">{t("signup.title")}</h1>
          <p className="mt-2 font-body-b text-[14px] text-white/60">
            {t("signup.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor={ids.plan} className={label}>{t("signup.plan")}</label>
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
                  {selected.quality ?? "HD"} · {selected.screen_limit ?? 1} {t("signup.screens")} · {planPrice(selected)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={ids.name} className={label}>{t("signup.name")}</label>
              <input id={ids.name} className={field} autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} placeholder={t("signup.namePlaceholder")} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={ids.cpf} className={label}>{t("signup.cpf")}</label>
                <input id={ids.cpf} className={field} inputMode="numeric" value={cpf}
                  aria-invalid={cpf.length > 0 && !isValidCpf(cpf)}
                  onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" required />
                {cpf.length > 0 && !isValidCpf(cpf) && (
                  <p className="mt-1.5 flex items-center gap-1.5 font-body-b text-[12px] text-[color:var(--color-tally)]">
                    <AlertCircle className="size-3.5" aria-hidden="true" />
                    {t(onlyDigits(cpf).length !== 11 ? "signup.errCpfDigits" : "signup.errCpfInvalid")}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={ids.whats} className={label}>{t("signup.whatsapp")}</label>
                <input id={ids.whats} className={field} inputMode="tel" autoComplete="tel" value={whatsapp}
                  aria-invalid={whatsapp.length > 0 && validateWhats(whatsapp) !== "ok"}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" required />
                {whatsapp.length > 0 && validateWhats(whatsapp) !== "ok" && (
                  <p className="mt-1.5 flex items-center gap-1.5 font-body-b text-[12px] text-[color:var(--color-tally)]">
                    <AlertCircle className="size-3.5" aria-hidden="true" />
                    {t(
                      validateWhats(whatsapp) === "ddd"
                        ? "signup.errWhatsDdd"
                        : validateWhats(whatsapp) === "mobile"
                          ? "signup.errWhatsMobile"
                          : "signup.errWhatsDigits",
                    )}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor={ids.ref} className={label}>{t("signup.ref")}</label>
              <input id={ids.ref} className={field} value={refCode} aria-describedby={`${ids.ref}-status`}
                aria-invalid={refStatus === "invalid"}
                onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder={t("signup.refPlaceholder")} />
              <p id={`${ids.ref}-status`} aria-live="polite" className="mt-1.5 min-h-4 font-body-b text-[12px]">
                {refStatus === "checking" && (
                  <span className="inline-flex items-center gap-1.5 text-white/50">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {t("signup.refChecking")}
                  </span>
                )}
                {refStatus === "valid" && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <Check className="size-3.5" aria-hidden="true" /> {t("signup.refValid")}
                  </span>
                )}
                {refStatus === "invalid" && (
                  <span className="inline-flex items-center gap-1.5 text-[color:var(--color-tally)]">
                    <X className="size-3.5" aria-hidden="true" /> {t("signup.refInvalid")}
                  </span>
                )}
              </p>
            </div>

            <div>
              <label htmlFor={ids.email} className={label}>{t("signup.email")}</label>
              <input id={ids.email} className={field} type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
            </div>

            <div>
              <label htmlFor={ids.pass} className={label}>{t("signup.password")}</label>
              <input id={ids.pass} className={field} type="password" autoComplete="new-password" minLength={8}
                aria-invalid={password.length > 0 && !pwdOk}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("signup.passwordPlaceholderStrong")} required />

              {password.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between font-mono-b text-[10px] uppercase tracking-[0.18em] text-white/45">
                    <span>{t("signup.pwdStrength")}</span>
                    <span
                      className={
                        pwdScore >= 4 ? "text-emerald-400" : pwdScore >= 3 ? "text-amber-400" : "text-[color:var(--color-tally)]"
                      }
                    >
                      {t(pwdScore >= 4 ? "signup.pwdStrong" : pwdScore >= 3 ? "signup.pwdMedium" : "signup.pwdWeak")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1" role="presentation">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < pwdScore
                            ? pwdScore >= 4
                              ? "bg-emerald-400"
                              : pwdScore >= 3
                                ? "bg-amber-400"
                                : "bg-[color:var(--color-tally)]"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {([
                      ["signup.pwdRuleLen", pwd.len],
                      ["signup.pwdRuleCase", pwd.caseMix],
                      ["signup.pwdRuleNum", pwd.num],
                      ["signup.pwdRuleSym", pwd.sym],
                    ] as const).map(([key, ok]) => (
                      <li
                        key={key}
                        className={`flex items-center gap-1.5 font-body-b text-[12px] ${ok ? "text-emerald-400" : "text-white/45"}`}
                      >
                        {ok ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label htmlFor={ids.pass2} className={label}>{t("signup.confirmPassword")}</label>
              <input id={ids.pass2} className={field} type="password" autoComplete="new-password" minLength={8}
                aria-invalid={password2.length > 0 && !confirmOk}
                value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder={t("signup.confirmPlaceholder")} required />
              {password2.length > 0 && !confirmOk && (
                <p className="mt-1.5 flex items-center gap-1.5 font-body-b text-[12px] text-[color:var(--color-tally)]">
                  <AlertCircle className="size-3.5" aria-hidden="true" /> {t("signup.errConfirm")}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[color:var(--color-tally)] px-5 py-3 font-mono-b text-[11px] font-bold uppercase tracking-[0.22em] text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("signup.submit")}
            </button>
          </form>

          <p className="mt-6 text-center font-body-b text-[13px] text-white/60">
            {t("signup.hasAccount")}{" "}
            <Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-white underline-offset-2 hover:underline">
              {t("signup.signin")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
