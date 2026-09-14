"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { notificationsApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export function NotificationsSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [marketingEmails, setMarketingEmails] = useState(false)
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false)

  useEffect(() => {
    setNotifPrefsLoading(true)
    notificationsApi.getPreferences()
      .then((prefs) => {
        setEmailNotifs(prefs.email_enabled)
        setPushNotifs(prefs.push_enabled)
        setWeeklyDigest(prefs.weekly_digest)
        setMarketingEmails(prefs.marketing_emails)
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setNotifPrefsLoading(false))
  }, [])

  const handleNotifToggle = async (key: string, current: boolean, setter: (v: boolean) => void) => {
    const newVal = !current
    setter(newVal)
    try {
      await notificationsApi.updatePreferences({ [key]: newVal })
      success(t("toast.updated", { entity: t("settings.notifications") }))
    } catch {
      setter(current)
      error(t("toast.error", { action: "update", entity: t("settings.notifications") }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {[
          { key: "email_enabled", label: t("settings.emailNotifications"), desc: t("settings.emailNotificationsDesc"), value: emailNotifs, onChange: setEmailNotifs },
          { key: "push_enabled", label: t("settings.newContactNotifications"), desc: t("settings.newContactNotificationsDesc"), value: pushNotifs, onChange: setPushNotifs },
          { key: "weekly_digest", label: t("settings.dealStageChanges"), desc: t("settings.dealStageChangesDesc"), value: weeklyDigest, onChange: setWeeklyDigest },
          { key: "marketing_emails", label: t("settings.activityReminders"), desc: t("settings.activityRemindersDesc"), value: marketingEmails, onChange: setMarketingEmails },
        ].map((item, idx) => (
          <label key={idx} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={item.value}
              disabled={notifPrefsLoading}
              onClick={() => handleNotifToggle(item.key, item.value, item.onChange)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                item.value ? "bg-brand" : "bg-gray-300 dark:bg-gray-600",
                notifPrefsLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition", item.value ? "translate-x-6" : "translate-x-1")} />
            </button>
          </label>
        ))}
      </div>
    </div>
  )
}
