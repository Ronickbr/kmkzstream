import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Search,
  Send,
  Shield,
  User,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — KMKZ IPTV" }] }),
  component: SupportPage,
});

type Category = "conta" | "pagamentos" | "indicacoes" | "premios" | "seguranca";

const CATEGORIES: { id: Category; label: string; icon: typeof User; color: string }[] = [
  { id: "conta", label: "Conta", icon: User, color: "text-primary" },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard, color: "text-primary" },
  { id: "indicacoes", label: "Indicações", icon: Users, color: "text-accent" },
  { id: "premios", label: "Prêmios", icon: Gift, color: "text-accent" },
  { id: "seguranca", label: "Segurança", icon: Shield, color: "text-primary" },
];

const FAQS: { q: string; a: string; cat: Category }[] = [
  { cat: "conta", q: "Como faço para criar uma conta?", a: "Clique em Começar agora, informe email e senha ou entre com Google. Sua conta e código de indicação são criados automaticamente." },
  { cat: "conta", q: "Como altero meu nome ou avatar?", a: "Acesse Painel → Minha conta. Você pode atualizar seu nome de exibição e URL do avatar a qualquer momento." },
  { cat: "pagamentos", q: "Quais formas de pagamento vocês aceitam?", a: "Aceitamos cartão de crédito (Visa, Master, Elo) e Pix. A ativação é imediata após a confirmação." },
  { cat: "pagamentos", q: "Posso cancelar quando quiser?", a: "Sim. A assinatura fica ativa até o fim do período contratado e não há cobranças futuras após o cancelamento." },
  { cat: "pagamentos", q: "Como funcionam os planos trimestral, semestral e anual?", a: "Quanto maior o período, maior a economia (até 28% no anual). A cobrança é única e o acesso vale por todo o período." },
  { cat: "indicacoes", q: "Como funciona o programa de indicações?", a: "Cada usuário recebe um código único. Quando alguém assina usando seu código, você ganha pontos proporcionais ao plano assinado pelo indicado." },
  { cat: "indicacoes", q: "Quando os pontos são creditados?", a: "Os pontos são creditados automaticamente assim que a assinatura do indicado for confirmada como ativa." },
  { cat: "indicacoes", q: "Existe limite de indicações?", a: "Não. Quanto mais pessoas você indicar, mais pontos acumula e melhores prêmios pode resgatar." },
  { cat: "premios", q: "Como resgato meus prêmios?", a: "Vá em Painel → Prêmios, escolha o item desejado e clique em Resgatar. Os pontos são debitados na hora e o resgate entra na fila de entrega." },
  { cat: "premios", q: "Meus pontos expiram?", a: "Não. Seus pontos ficam disponíveis enquanto sua conta estiver ativa." },
  { cat: "seguranca", q: "Meus dados estão seguros?", a: "Usamos criptografia em trânsito e armazenamento seguro. Nunca guardamos dados sensíveis de cartão em nossos servidores." },
  { cat: "seguranca", q: "Como faço para excluir minha conta?", a: "Envie uma solicitação pelo formulário de contato abaixo com o assunto Exclusão de conta. Processamos em até 7 dias úteis." },
];

function SupportPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "todas">("todas");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (cat !== "todas" && f.cat !== cat) return false;
      if (!q) return true;
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    });
  }, [query, cat]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Hero */}
      <section
        aria-labelledby="support-heading"
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <LifeBuoy className="size-3.5 text-primary" aria-hidden="true" />
            Central de Suporte
          </div>
          <h1 id="support-heading" className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Como podemos ajudar?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Respostas rápidas sobre assinaturas, indicações, prêmios e mais. Ou fale direto com nossa equipe.
          </p>

          <div className="mt-6 flex max-w-2xl items-center gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="ml-2 size-5 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="support-search" className="sr-only">Buscar na central de ajuda</label>
            <input
              id="support-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por palavra-chave (ex: cartão, pontos, cancelar)"
              className="flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </section>

      {/* Atalhos rápidos */}
      <section aria-label="Atalhos" className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickLink to="/indicacoes" icon={Users} title="Minhas indicações" desc="Acompanhe status e pontos" tone="primary" />
        <QuickLink to="/premios" icon={Gift} title="Prêmios" desc="Resgate seus pontos" tone="accent" />
        <QuickLink to="/planos" icon={CreditCard} title="Planos" desc="Ver e trocar assinatura" tone="primary" />
      </section>

      {/* Categorias */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CategoryChip active={cat === "todas"} onClick={() => setCat("todas")} icon={HelpCircle} label="Todas" color="text-foreground" />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} icon={c.icon} label={c.label} color={c.color} />
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Perguntas frequentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </p>

          <ul className="mt-5 space-y-3">
            {filtered.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
                Nenhum resultado. Tente outra palavra ou nos envie uma mensagem.
              </li>
            )}
            {filtered.map((f, i) => {
              const id = `faq-${i}`;
              const isOpen = open === id;
              return (
                <li key={id} className="overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:border-primary/40">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : id)}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-content`}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-foreground">{f.q}</span>
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div id={`${id}-content`} className="border-t border-border/60 px-5 py-4 text-sm text-foreground/80">
                      {f.a}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="space-y-4">
          <ContactCard />
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-bold text-foreground">Fale por chat</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Nossa equipe responde de seg a sex, 9h às 18h.</p>
            <button
              type="button"
              onClick={() => toast.info("Chat em breve — enquanto isso, use o formulário ao lado.")}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-4 text-sm font-semibold text-foreground hover:bg-background"
            >
              Abrir chat
            </button>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-accent" aria-hidden="true" />
              <h3 className="font-bold text-foreground">Email direto</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Prefere email? Escreva para{" "}
              <a href="mailto:suporte@nexus.app" className="font-semibold text-primary hover:underline">suporte@nexus.app</a>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  desc,
  tone,
}: {
  to: "/indicacoes" | "/premios" | "/planos";
  icon: typeof User;
  title: string;
  desc: string;
  tone: "primary" | "accent";
}) {
  const toneCls = tone === "primary" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent";
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40"
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneCls}`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition group-hover:text-foreground" aria-hidden="true" />
    </Link>
  );
}

function CategoryChip({ active, onClick, icon: Icon, label, color }: { active: boolean; onClick: () => void; icon: typeof User; label: string; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-semibold transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-muted-foreground hover:border-primary/40"
      }`}
    >
      <Icon className={`size-5 ${active ? "text-primary-foreground" : color}`} aria-hidden="true" />
      {label}
    </button>
  );
}

function ContactCard() {
  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const msgId = useId();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const valid =
    form.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.subject.trim().length >= 3 &&
    form.message.trim().length >= 10;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setForm({ name: "", email: "", subject: "", message: "" });
      toast.success("Mensagem enviada! Retornaremos em até 24h úteis.");
    }, 700);
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-border/60 bg-card p-6" aria-labelledby="contact-heading">
      <h3 id="contact-heading" className="font-display text-lg font-bold text-foreground">Envie uma mensagem</h3>
      <p className="mt-1 text-xs text-muted-foreground">Resposta média em 24h úteis.</p>

      <div className="mt-4 space-y-3">
        <Field id={nameId} label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
        <Field id={emailId} label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
        <Field id={subjectId} label="Assunto" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
        <div>
          <label htmlFor={msgId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Mensagem</label>
          <textarea
            id={msgId}
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            aria-required="true"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!valid || busy}
        aria-busy={busy}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="size-4" aria-hidden="true" />
        {busy ? "Enviando…" : "Enviar mensagem"}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-required="true"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
