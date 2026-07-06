"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type Locale = "es" | "en";
type Translations = Record<string, string | Record<string, unknown>>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number> | string) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveNestedKey(
  obj: Translations,
  key: string
): string | Record<string, unknown> | undefined {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj) as string | Record<string, unknown> | undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

const STORAGE_KEY = "opencrm-locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "es" || stored === "en") return stored;
  const browserLang = navigator.language?.slice(0, 2);
  return browserLang === "es" ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadTranslations = useCallback(async (l: Locale) => {
    setIsLoading(true);
    try {
      const mod = await import(`@/lib/i18n/${l}.json`);
      setTranslations(mod.default ?? mod);
    } catch {
      setTranslations({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setLocale = useCallback(
    (l: Locale) => {
      setLocaleState(l);
      localStorage.setItem(STORAGE_KEY, l);
      loadTranslations(l);
    },
    [loadTranslations]
  );

  useEffect(() => {
    loadTranslations(locale);
  }, [locale, loadTranslations]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number> | string): string => {
      if (typeof params === "string") {
        const value = resolveNestedKey(translations, key);
        return typeof value === "string" ? value : params;
      }
      const value = resolveNestedKey(translations, key);
      if (typeof value === "string") return interpolate(value, params);
      return key;
    },
    [translations]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
