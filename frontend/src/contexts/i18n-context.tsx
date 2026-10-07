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

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with a deterministic default to avoid SSR/hydration mismatch;
  // the stored/browser locale is applied in `useEffect` below.
  const [locale, setLocaleState] = useState<Locale>("en");
  const [translations, setTranslations] = useState<Translations>({});
  const [fallbackTranslations, setFallbackTranslations] = useState<Translations>({});
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
      try {
        localStorage.setItem(STORAGE_KEY, l);
      } catch {
        // storage unavailable (private mode) — ignore
      }
      if (typeof document !== "undefined") {
        document.documentElement.lang = l;
      }
      loadTranslations(l);
    },
    [loadTranslations]
  );

  // Apply stored/browser locale after mount (localStorage is client-only).
  useEffect(() => {
    let initial: Locale = "en";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "es" || stored === "en") {
        initial = stored;
      } else {
        const browserLang = navigator.language?.slice(0, 2);
        initial = browserLang === "es" ? "es" : "en";
      }
    } catch {
      initial = "en";
    }
    setLocaleState(initial);
    if (typeof document !== "undefined") {
      document.documentElement.lang = initial;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload Spanish as fallback for missing keys.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import(`@/lib/i18n/es.json`);
        if (!cancelled) setFallbackTranslations(mod.default ?? mod);
      } catch {
        // fallback stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadTranslations(locale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale, loadTranslations]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number> | string): string => {
      if (typeof params === "string") {
        const value = resolveNestedKey(translations, key);
        if (typeof value === "string") return value;
        const fallback = resolveNestedKey(fallbackTranslations, key);
        return typeof fallback === "string" ? fallback : params;
      }
      const value = resolveNestedKey(translations, key);
      if (typeof value === "string") return interpolate(value, params);
      // Fallback to Spanish when the key is missing in the active locale.
      const fallback = resolveNestedKey(fallbackTranslations, key);
      if (typeof fallback === "string") return interpolate(fallback, params);
      return key;
    },
    [translations, fallbackTranslations]
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
