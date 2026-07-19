export function formatCurrencyBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export const PLAN_PERIOD_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const PLAN_PERIOD_SHORT: Record<string, string> = {
  monthly: "/mês",
  quarterly: "/trim",
  semiannual: "/sem",
  annual: "/ano",
};

export const PLAN_ECONOMY_LABEL: Record<string, string | null> = {
  monthly: null,
  quarterly: "Economize 6%",
  semiannual: "Economize 14%",
  annual: "Economize 28%",
};
