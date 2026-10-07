"use client"

import { Check, Moon, Sun } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useTheme } from "@/contexts/theme-context"
import { cn } from "@/lib/utils"

export function AppearanceSection() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left bg-card",
            theme === "light"
              ? "border-primary bg-primary/[0.05]"
              : "border-border hover:border-muted-foreground/30"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Sun className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("settings.lightMode")}</p>
          </div>
          {theme === "light" && <Check className="h-5 w-5 text-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left bg-card",
            theme === "dark"
              ? "border-primary bg-primary/[0.05]"
              : "border-border hover:border-muted-foreground/30"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("settings.darkMode")}</p>
          </div>
          {theme === "dark" && <Check className="h-5 w-5 text-primary" />}
        </button>
      </div>
    </div>
  )
}
