"use client";

import { useI18n } from "@/contexts/i18n-context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "es" ? "en" : "es")}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white/80 hover:text-white transition-colors"
      aria-label={`Switch language to ${locale === "es" ? "English" : "Español"}`}
    >
      {locale === "es" ? "EN" : "ES"}
    </button>
  );
}
