import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DICTIONARIES, LOCALES, LOCALE_META, USD_PRICE_CENTS, type Locale } from "./i18n-dict";

export { LOCALES, LOCALE_META, USD_PRICE_CENTS };
export type { Locale };

const STORAGE_KEY = "kmkz_locale";
/** Fallback de conversão quando o período não tem preço em dólar tabelado. */
const BRL_TO_USD = 5.4;

type I18nValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  currency: "BRL" | "USD";
  /** Formata um valor em centavos na moeda do idioma atual (converte de BRL quando necessário). */
  money: (brlCents: number) => string;
  /** Preço de um plano na moeda do idioma atual. */
  planPrice: (plan: { period?: string | null; price_cents: number }) => string;
  /** Valor bruto em centavos do plano na moeda ativa (para cálculos). */
  planPriceCents: (plan: { period?: string | null; price_cents: number }) => number;
};

const I18nContext = createContext<I18nValue | null>(null);

function detectLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  const nav = window.navigator.language?.toLowerCase() ?? "pt";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("pt")) return "pt";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Sempre inicia em "pt" para casar com o HTML do servidor; ajusta após hidratar.
  const [locale, setLocaleState] = useState<Locale>("pt");

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "pt") setLocaleState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = LOCALE_META[locale].intl;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage indisponível */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale];
    const meta = LOCALE_META[locale];

    const t = (key: string, vars?: Record<string, string | number>) => {
      let out = dict[key] ?? DICTIONARIES.pt[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      }
      return out;
    };

    const fmt = (cents: number) =>
      new Intl.NumberFormat(meta.intl, { style: "currency", currency: meta.currency }).format(cents / 100);

    const toCents = (plan: { period?: string | null; price_cents: number }) => {
      if (meta.currency === "BRL") return plan.price_cents;
      const mapped = plan.period ? USD_PRICE_CENTS[plan.period] : undefined;
      return mapped ?? Math.round(plan.price_cents / BRL_TO_USD);
    };

    return {
      locale,
      setLocale,
      t,
      currency: meta.currency,
      money: (brlCents: number) => fmt(meta.currency === "BRL" ? brlCents : Math.round(brlCents / BRL_TO_USD)),
      planPrice: (plan) => fmt(toCents(plan)),
      planPriceCents: toCents,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n deve ser usado dentro de <I18nProvider>");
  return ctx;
}
