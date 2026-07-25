import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateMyProfile } from "@/lib/user.functions";
import { overviewQueryOptions as overviewQO } from "@/lib/queries";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, MessageCircle, MapPin, FileText, Image as ImageIcon, KeyRound, ShieldCheck, Copy, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQO),
  component: MinhaContaPage,
});

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_,a,b,c) => [a && `(${a}`, a && a.length===2 && ") ", b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_, a, b, c, e) =>
    [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join("")
  );
}

function MinhaContaPage() {
  const { data, refetch } = useSuspenseQuery(overviewQO);
  const updateFn = useServerFn(updateMyProfile);
  const p = data.profile;
  const [name, setName] = useState(p?.display_name ?? "");
  const [avatar, setAvatar] = useState(p?.avatar_url ?? "");
  const [whatsapp, setWhatsapp] = useState(p?.whatsapp ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [bio, setBio] = useState(p?.bio ?? "");
  const [city, setCity] = useState(p?.city ?? "");
  const [state, setState] = useState(p?.state ?? "");
  const [cpf, setCpf] = useState(formatCpf(p?.cpf ?? ""));
  const [saving, setSaving] = useState(false);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe seu nome");
    setSaving(true);
    try {
      await updateFn({ data: {
        display_name: name.trim(),
        avatar_url: avatar || null,
        whatsapp: whatsapp || null,
        phone: phone || null,
        bio: bio || null,
        city: city || null,
        state: state || null,
        cpf: cpf ? cpf.replace(/\D/g, "") : null,
      }});
      toast.success("Perfil atualizado");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Senha alterada com sucesso");
      setPwd(""); setPwd2("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar senha");
    } finally {
      setChangingPwd(false);
    }
  };

  const copyCode = async () => {
    if (!p?.referral_code) return;
    await navigator.clipboard.writeText(p.referral_code);
    toast.success("Código copiado");
  };

  const initials = (name || data.email || "?").slice(0,2).toUpperCase();

  return (
    <div id="main" role="main" className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-gradient-brand">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie suas informações pessoais e segurança.</p>
      </header>

      {/* Header card */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-elevate">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-accent ring-2 ring-border">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">{initials}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-xl font-bold">{name || "Sem nome"}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground truncate">
              <Mail className="h-3.5 w-3.5 shrink-0" /> {data.email ?? "—"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
                {data.points} pontos
              </span>
              {p?.created_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Membro desde {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono hover:bg-muted"
            aria-label="Copiar código de indicação"
          >
            <Copy className="h-3.5 w-3.5" />
            {p?.referral_code}
          </button>
        </div>
      </section>

      {/* Profile form */}
      <form onSubmit={handleSave} className="rounded-3xl border border-border bg-card p-6 shadow-elevate space-y-5">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-brand" />
          <h2 className="font-display text-lg font-bold">Informações pessoais</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome de exibição" icon={<User className="h-3.5 w-3.5" />} required>
            <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className={inputCls} required maxLength={80} />
          </Field>

          <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />} hint="Não é possível alterar aqui">
            <input type="email" value={data.email ?? ""} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </Field>

          <Field label="WhatsApp" icon={<MessageCircle className="h-3.5 w-3.5" />}>
            <input type="tel" value={whatsapp} onChange={(e)=>setWhatsapp(formatPhone(e.target.value))} placeholder="(11) 91234-5678" className={inputCls} />
          </Field>

          <Field label="Telefone" icon={<Phone className="h-3.5 w-3.5" />}>
            <input type="tel" value={phone} onChange={(e)=>setPhone(formatPhone(e.target.value))} placeholder="(11) 3456-7890" className={inputCls} />
          </Field>

          <Field label="Cidade" icon={<MapPin className="h-3.5 w-3.5" />}>
            <input type="text" value={city} onChange={(e)=>setCity(e.target.value)} className={inputCls} maxLength={80} />
          </Field>

          <Field label="Estado" icon={<MapPin className="h-3.5 w-3.5" />}>
            <select value={state} onChange={(e)=>setState(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="CPF" icon={<ShieldCheck className="h-3.5 w-3.5" />} hint="Usado para prevenir fraudes e cadastros duplicados">
            <input type="text" value={cpf} onChange={(e)=>setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" className={inputCls} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="URL do avatar" icon={<ImageIcon className="h-3.5 w-3.5" />}>
              <input type="url" value={avatar} onChange={(e)=>setAvatar(e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Bio" icon={<FileText className="h-3.5 w-3.5" />} hint={`${bio.length}/280`}>
              <textarea value={bio} onChange={(e)=>setBio(e.target.value.slice(0,280))} rows={3} className={`${inputCls} resize-none`} placeholder="Conte um pouco sobre você" />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-50 transition">
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handleChangePassword} className="rounded-3xl border border-border bg-card p-6 shadow-elevate space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" />
          <h2 className="font-display text-lg font-bold">Alterar senha</h2>
        </div>
        <p className="text-sm text-muted-foreground">Escolha uma senha forte com pelo menos 8 caracteres.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha">
            <input type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} className={inputCls} minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" value={pwd2} onChange={(e)=>setPwd2(e.target.value)} className={inputCls} minLength={8} autoComplete="new-password" />
          </Field>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={changingPwd || !pwd} className="rounded-xl border border-border bg-muted px-6 py-2.5 text-sm font-bold hover:bg-muted/70 disabled:opacity-50 transition">
            {changingPwd ? "Alterando…" : "Alterar senha"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition";

function Field({ label, icon, hint, required, children }: { label: string; icon?: React.ReactNode; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon}{label}{required && <span className="text-destructive">*</span>}
        </span>
        {hint && <span className="normal-case tracking-normal font-normal text-[10px] text-muted-foreground/70">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
