import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n, LOCALES, LOCALE_META } from "@/lib/i18n";

export function LanguageSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "dark"
      ? "border-white/15 bg-white/[0.03] text-white/80 hover:border-white/40 hover:text-white"
      : "border-border bg-card text-foreground hover:bg-accent/10";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("common.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2.5 py-1.5 font-mono-b text-[11px] font-bold uppercase tracking-[0.18em] transition ${trigger}`}
      >
        <Globe className="size-3.5" aria-hidden="true" />
        {LOCALE_META[locale].short}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            role="listbox"
            className="absolute right-0 z-[61] mt-2 w-44 overflow-hidden rounded-sm border border-white/10 bg-[#0b0b0d] py-1 shadow-2xl"
          >
            {LOCALES.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l === locale}
                  onClick={() => {
                    setLocale(l);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-body-b text-sm text-white/80 hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{LOCALE_META[l].flag}</span>
                    {LOCALE_META[l].label}
                  </span>
                  {l === locale && <Check className="size-3.5 text-[color:var(--color-tally)]" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
