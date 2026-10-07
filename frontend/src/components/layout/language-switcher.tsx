"use client";

import { useI18n } from "@/contexts/i18n-context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "es" ? "en" : "es")}
      className="flex h-8 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label={`Switch language to ${locale === "es" ? "English" : "Español"}`}
    >
      {locale === "es" ? "EN" : "ES"}
    </button>
  );
}
