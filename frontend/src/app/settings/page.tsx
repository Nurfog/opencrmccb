"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { User, Shield, Bell, Palette, Globe, Plug, Camera, Moon, Sun, Save, Check, ExternalLink, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/contexts/toast-context"
import { useTheme } from "@/contexts/theme-context"
import { authApi, integrationsApi, whatsAppApi, aiApi, type IntegrationStatus, type WhatsAppConfig, type LeadAssignmentConfig, type AIConfig } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { ChangePasswordForm } from "@/components/forms/change-password-form"
import { cn } from "@/lib/utils"

type SettingsTab = "profile" | "security" | "notifications" | "appearance" | "language" | "integrations"

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "settings.profile", icon: User },
  { id: "security", label: "settings.security", icon: Shield },
  { id: "notifications", label: "settings.notifications", icon: Bell },
  { id: "appearance", label: "settings.appearance", icon: Palette },
  { id: "language", label: "settings.language", icon: Globe },
  { id: "integrations", label: "settings.integrations", icon: Plug },
]

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { user, updateUser } = useAuthStore()
  const { success, error } = useToast()
  const { theme, setTheme } = useTheme()

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [profileLoading, setProfileLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "")
      setLastName(user.last_name ?? "")
      setEmail(user.email ?? "")
    }
  }, [user])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const updated = await authApi.updateProfile({ first_name: firstName, last_name: lastName, email })
      updateUser(updated)
      success(t("toast.updated", { entity: t("settings.profile") }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "update", entity: t("settings.profile") })
      error(msg)
    } finally {
      setProfileLoading(false)
    }
  }

  // ─── Integrations ───
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(false)

  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true)
    try {
      const res = await integrationsApi.list()
      setIntegrations(res)
    } catch {
      // ignore
    } finally {
      setIntegrationsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "integrations") fetchIntegrations()
  }, [activeTab, fetchIntegrations])

  // Check for OAuth callback result in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const integration = params.get("integration")
    const status = params.get("status")
    if (integration && status === "connected") {
      success(t("settings.integrationConnected", { provider: integration }))
      window.history.replaceState({}, "", "/settings")
      fetchIntegrations()
    }
    if (integration && status === "error") {
      error(t("settings.integrationError", { provider: integration }))
      window.history.replaceState({}, "", "/settings")
    }
  }, [success, error, t, fetchIntegrations])

  const handleConnect = async (provider: string) => {
    try {
      const res = await integrationsApi.connect(provider)
      window.location.href = res.auth_url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "connect", entity: provider })
      error(msg)
    }
  }

  const handleDisconnect = async (provider: string) => {
    try {
      await integrationsApi.disconnect(provider)
      success(t("toast.deleted", { entity: provider }))
      fetchIntegrations()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "disconnect", entity: provider })
      error(msg)
    }
  }

  // ─── WhatsApp config ───
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [waPhoneId, setWaPhoneId] = useState("")
  const [waBusinessId, setWaBusinessId] = useState("")
  const [waApiToken, setWaApiToken] = useState("")
  const [waPhoneNumber, setWaPhoneNumber] = useState("")
  const [waConfigSaving, setWaConfigSaving] = useState(false)
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null)

  const fetchWhatsAppConfig = useCallback(async () => {
    try {
      const cfg = await whatsAppApi.getConfig()
      setWaConfig(cfg)
      setWaPhoneId(cfg.phone_number_id)
      setWaBusinessId(cfg.business_account_id)
      setWaPhoneNumber(cfg.phone_number ?? "")
    } catch {
      setWaConfig(null)
    }
  }, [])

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaConfigSaving(true)
    try {
      const cfg = await whatsAppApi.updateConfig({
        phone_number_id: waPhoneId,
        business_account_id: waBusinessId,
        api_token: waApiToken,
        phone_number: waPhoneNumber || undefined,
      })
      setWaConfig(cfg)
      success(t("settings.whatsappSaved"))
      setWhatsappModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("settings.whatsappSaveError")
      error(msg)
    } finally {
      setWaConfigSaving(false)
    }
  }

  // ─── Lead assignment config ───
  const [leadConfig, setLeadConfig] = useState<LeadAssignmentConfig | null>(null)
  const [leadConfigOpen, setLeadConfigOpen] = useState(false)
  const [leadStrategy, setLeadStrategy] = useState("round_robin")
  const [leadMax, setLeadMax] = useState(10)
  const [leadNotify, setLeadNotify] = useState(true)
  const [leadSaving, setLeadSaving] = useState(false)

  const fetchLeadConfig = useCallback(async () => {
    try {
      const cfg = await whatsAppApi.getLeadAssignmentConfig()
      setLeadConfig(cfg)
      setLeadStrategy(cfg.strategy)
      setLeadMax(cfg.max_active_leads)
      setLeadNotify(cfg.notify_on_assign)
    } catch {
      // ignore
    }
  }, [])

  const handleSaveLeadConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setLeadSaving(true)
    try {
      const cfg = await whatsAppApi.updateLeadAssignmentConfig({
        strategy: leadStrategy,
        max_active_leads: leadMax,
        notify_on_assign: leadNotify,
      })
      setLeadConfig(cfg)
      success(t("settings.leadAssignmentSaved"))
      setLeadConfigOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("settings.leadAssignmentSaveError")
      error(msg)
    } finally {
      setLeadSaving(false)
    }
  }

  // ─── AI config ───
  const [aiConfigModal, setAiConfigModal] = useState(false)
  const [aiCfg, setAiCfg] = useState<AIConfig | null>(null)
  const [aiProvider, setAiProvider] = useState("ollama")
  const [aiUrl, setAiUrl] = useState("http://localhost:11434")
  const [aiModel, setAiModel] = useState("llama3.2")
  const [aiKey, setAiKey] = useState("")
  const [aiSaving, setAiSaving] = useState(false)

  const fetchAiConfig = useCallback(async () => {
    try {
      const cfg = await aiApi.getConfig()
      setAiCfg(cfg)
      setAiProvider(cfg.provider)
      setAiUrl(cfg.api_url)
      setAiModel(cfg.model)
    } catch { /* ignore */ }
  }, [])

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault()
    setAiSaving(true)
    try {
      const cfg = await aiApi.updateConfig({
        provider: aiProvider, api_url: aiUrl, model: aiModel, api_key: aiKey || undefined,
      })
      setAiCfg(cfg)
      success(t("settings.aiSaved"))
      setAiConfigModal(false)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t("settings.aiSaveError"))
    } finally {
      setAiSaving(false)
    }
  }

  const PROVIDER_META: Record<string, { name: string; description: string; type: string }> = {
    google: { name: "Google", description: "Calendar, Drive, Gmail", type: "oauth" },
    microsoft: { name: "Microsoft", description: "Outlook Calendar, OneDrive, Teams", type: "oauth" },
    whatsapp: { name: "WhatsApp", description: "WhatsApp Business API — mensajería y notificaciones", type: "whatsapp" },
    telegram: { name: "Telegram", description: "Mensajería, notificaciones", type: "oauth" },
    twilio: { name: "Twilio", description: "SMS, llamadas de voz", type: "oauth" },
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("avatar", file)
    try {
      const res = await fetch("/api/auth/me/", { method: "PATCH", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      updateUser(data)
      success(t("toast.updated", { entity: t("settings.profile") }))
    } catch {
      error(t("toast.error", { action: "upload", entity: "avatar" }))
    }
  }, [updateUser, success, error, t])

  const renderTab = () => {
    switch (activeTab) {
      case "profile":
        return (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-semibold">
                  {user ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}` : "U"}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="text-sm font-medium">{user ? `${user.first_name} ${user.last_name}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.permissions?.length ? `${user.permissions.length} permisos` : "Sin perfil"}
                </p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-brand hover:underline mt-1">
                  {t("settings.changePhoto")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="slds-label" htmlFor="firstName">{t("settings.firstName")}</label>
                <input id="firstName" className="slds-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="slds-label" htmlFor="lastName">{t("settings.lastName")}</label>
                <input id="lastName" className="slds-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="slds-label" htmlFor="email">{t("settings.email")}</label>
                <input id="email" type="email" className="slds-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <button type="submit" disabled={profileLoading} className="slds-btn slds-btn--brand flex items-center gap-2">
              <Save className="h-4 w-4" />
              {profileLoading ? t("app.loading") : t("common.saveChanges")}
            </button>
          </form>
        )

      case "security":
        return <ChangePasswordForm />

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{t("settings.emailNotifications")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.emailNotificationsDesc")}</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                </div>
              </label>
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{t("settings.newContactNotifications")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.newContactNotificationsDesc")}</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                </div>
              </label>
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{t("settings.dealStageChanges")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.dealStageChangesDesc")}</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                </div>
              </label>
              <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{t("settings.activityReminders")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.activityRemindersDesc")}</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                </div>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{t("settings.notificationsNotPersisted")}</p>
          </div>
        )

      case "appearance":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left",
                  theme === "light"
                    ? "border-brand bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Sun className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("settings.lightMode")}</p>
                </div>
                {theme === "light" && <Check className="h-5 w-5 text-brand" />}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left",
                  theme === "dark"
                    ? "border-brand bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("settings.darkMode")}</p>
                </div>
                {theme === "dark" && <Check className="h-5 w-5 text-brand" />}
              </button>
            </div>
          </div>
        )

      case "language":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left",
                  locale === "es"
                    ? "border-brand bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-base font-bold text-red-600 dark:text-red-400">ES</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("settings.spanish")}</p>
                  <p className="text-xs text-muted-foreground">Español</p>
                </div>
                {locale === "es" && <Check className="h-5 w-5 text-brand" />}
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left",
                  locale === "en"
                    ? "border-brand bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">EN</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("settings.english")}</p>
                  <p className="text-xs text-muted-foreground">English</p>
                </div>
                {locale === "en" && <Check className="h-5 w-5 text-brand" />}
              </button>
            </div>
          </div>
        )

      case "integrations":
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">{t("settings.integrationsDescription")}</p>
            <div className="space-y-3">
              {Object.entries(PROVIDER_META).map(([key, meta]) => {
                const integ = integrations.find((i) => i.provider === key)
                const connected = integ?.connected ?? false
                const isWhatsApp = key === "whatsapp"
                const waConfigured = waConfig !== null
                return (
                  <div key={key} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Plug className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{meta.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                        {isWhatsApp && waConfigured && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            {waConfig.phone_number ?? t("settings.configured")}
                          </p>
                        )}
                        {!isWhatsApp && connected && integ?.provider_email && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{integ.provider_email}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      {isWhatsApp ? (
                        <button
                          type="button"
                          onClick={() => { fetchWhatsAppConfig(); setWhatsappModalOpen(true) }}
                          className="slds-btn slds-btn--neutral flex items-center gap-2 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {waConfigured ? t("common.configure") : t("common.connect")}
                        </button>
                      ) : connected ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(key)}
                          className="slds-btn slds-btn--neutral text-red-500 flex items-center gap-2 text-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("common.disconnect")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(key)}
                          className="slds-btn slds-btn--neutral flex items-center gap-2 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t("common.connect")}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* WhatsApp Config Modal */}
            <Modal isOpen={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)} title={t("settings.whatsappConfigTitle")} size="lg">
              <form onSubmit={handleSaveWhatsApp} className="space-y-4">
                <div>
                  <label className="slds-label">{t("settings.phoneNumberId")}</label>
                  <input className="slds-input" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} placeholder="123456789" required />
                </div>
                <div>
                  <label className="slds-label">{t("settings.businessAccountId")}</label>
                  <input className="slds-input" value={waBusinessId} onChange={(e) => setWaBusinessId(e.target.value)} placeholder="123456789" required />
                </div>
                <div>
                  <label className="slds-label">{t("settings.apiToken")}</label>
                  <input className="slds-input font-mono" value={waApiToken} onChange={(e) => setWaApiToken(e.target.value)} placeholder="EAAx..." type="password" required />
                </div>
                <div>
                  <label className="slds-label">{t("settings.whatsappNumber")}</label>
                  <input className="slds-input" value={waPhoneNumber} onChange={(e) => setWaPhoneNumber(e.target.value)} placeholder="+56912345678" />
                  <p className="text-xs text-muted-foreground mt-1">{t("settings.whatsappNumberFormat")}</p>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium mb-2">{t("settings.webhook")}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("settings.webhookDesc")}
                  </p>
                  <code className="block p-2 rounded bg-gray-100 dark:bg-gray-800 text-xs break-all font-mono">
                    {`${window.location.origin}/api/v1/integrations/whatsapp/webhook`}
                  </code>
                  {waConfig?.webhook_verify_token && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("settings.verifyToken")} <code className="font-mono">{waConfig.webhook_verify_token}</code>
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setWhatsappModalOpen(false)} className="slds-btn slds-btn--neutral">
                    {t("common.cancel")}
                  </button>
                  <button type="submit" disabled={waConfigSaving} className="slds-btn slds-btn--brand">
                    {waConfigSaving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            </Modal>

            {/* Lead assignment section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">{t("settings.leadAssignment")}</h3>
                  <p className="text-xs text-muted-foreground">{t("settings.leadAssignmentDesc")}</p>
                </div>
                <button type="button" onClick={() => { fetchLeadConfig(); setLeadConfigOpen(true) }} className="slds-btn slds-btn--neutral flex items-center gap-2 text-sm">
                  <span>{t("common.configure")}</span>
                </button>
              </div>
              {leadConfig && (
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">{t("settings.assignmentStrategy")}:</span>
                  <span className="font-medium capitalize">{leadConfig.strategy.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{t("settings.maxActiveLeads")}:</span>
                  <span className="font-medium">{leadConfig.max_active_leads}</span>
                </div>
              )}
            </div>

            {/* AI config section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">{t("settings.aiConfig")}</h3>
                  <p className="text-xs text-muted-foreground">{t("settings.aiConfigDesc")}</p>
                </div>
                <button type="button" onClick={() => { fetchAiConfig(); setAiConfigModal(true) }} className="slds-btn slds-btn--neutral flex items-center gap-2 text-sm">
                  <span>{t("common.configure")}</span>
                </button>
              </div>
              {aiCfg && (
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">{t("settings.aiProvider")}:</span>
                  <span className="font-medium capitalize">{aiCfg.provider}</span>
                  <span className="text-muted-foreground">{t("settings.aiModel")}:</span>
                  <span className="font-medium">{aiCfg.model}</span>
                </div>
              )}
            </div>

            <Modal isOpen={aiConfigModal} onClose={() => setAiConfigModal(false)} title={t("settings.aiConfig") + " - " + t("leads.convert")}>
              <form onSubmit={handleSaveAi} className="space-y-4">
                <div>
                  <label className="slds-label">{t("settings.aiProvider")}</label>
                  <select className="slds-input" value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
                    <option value="ollama">Ollama (local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="slds-label">{t("settings.aiApiUrl")}</label>
                  <input className="slds-input" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)}
                    placeholder="http://localhost:11434" />
                </div>
                <div>
                  <label className="slds-label">{t("settings.aiModel")}</label>
                  <input className="slds-input" value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                    placeholder="llama3.2, gpt-4o-mini, claude-3-haiku..." />
                </div>
                <div>
                  <label className="slds-label">{t("settings.aiApiKey")} {aiProvider === "ollama" ? <span className="text-muted-foreground">({t("settings.aiApiKeyOptional")})</span> : ""}</label>
                  <input className="slds-input font-mono" type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)}
                    placeholder={aiProvider === "ollama" ? "Dejar vacío para Ollama local" : "sk-..."} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setAiConfigModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
                  <button type="submit" disabled={aiSaving} className="slds-btn slds-btn--brand">
                    {aiSaving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            </Modal>

            {/* Lead Assignment Config Modal */}
            <Modal isOpen={leadConfigOpen} onClose={() => setLeadConfigOpen(false)} title={t("settings.leadAssignment")}>
              <form onSubmit={handleSaveLeadConfig} className="space-y-4">
                <div>
                  <label className="slds-label">{t("settings.assignmentStrategy")}</label>
                  <select className="slds-input" value={leadStrategy} onChange={(e) => setLeadStrategy(e.target.value)}>
                    <option value="round_robin">{t("settings.strategyRoundRobin")}</option>
                    <option value="least_busy">{t("settings.strategyLeastBusy")}</option>
                    <option value="manual">{t("settings.strategyManual")}</option>
                  </select>
                </div>
                <div>
                  <label className="slds-label">{t("settings.maxActiveLeads")}</label>
                  <input type="number" className="slds-input" value={leadMax} onChange={(e) => setLeadMax(parseInt(e.target.value) || 10)} min={1} max={100} />
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={leadNotify} onChange={(e) => setLeadNotify(e.target.checked)} className="rounded" />
                    <span className="text-sm">{t("settings.notifyOnAssign")}</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setLeadConfigOpen(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
                  <button type="submit" disabled={leadSaving} className="slds-btn slds-btn--brand">
                    {leadSaving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            </Modal>

          </div>
        )

      default:
        return null
    }
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("settings.title")}</h1>
            <p className="slds-header__description">{t("settings.description")}</p>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(tab.label)}
              </button>
            )
          })}
        </div>

        <div className="slds-card p-6">
          {renderTab()}
        </div>
      </div>
    </AppLayout>
  )
}
