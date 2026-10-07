"use client"

import { Check } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { cn } from "@/lib/utils"

export function LanguageSection() {
  const { t, locale, setLocale } = useI18n()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setLocale("es")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left bg-card",
            locale === "es"
              ? "border-primary bg-primary/[0.05]"
              : "border-border hover:border-muted-foreground/30"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-base font-bold text-red-600 dark:text-red-400">ES</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("settings.spanish")}</p>
            <p className="text-xs text-muted-foreground">Español</p>
          </div>
          {locale === "es" && <Check className="h-5 w-5 text-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left bg-card",
            locale === "en"
              ? "border-primary bg-primary/[0.05]"
              : "border-border hover:border-muted-foreground/30"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">EN</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("settings.english")}</p>
            <p className="text-xs text-muted-foreground">English</p>
          </div>
          {locale === "en" && <Check className="h-5 w-5 text-primary" />}
        </button>
      </div>
    </div>
  )
}
