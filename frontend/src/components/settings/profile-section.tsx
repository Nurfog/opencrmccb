"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { Camera, Save } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/contexts/toast-context"
import { authApi } from "@/lib/api"

export function ProfileSection() {
  const { t } = useI18n()
  const { user, updateUser } = useAuthStore()
  const { success, error } = useToast()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
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

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
    success(t("toast.updated", { entity: t("settings.profile") }))
  }, [success, t])

  return (
    <form onSubmit={handleProfileSubmit} className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="relative">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-semibold">
              {user ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}` : "U"}
            </div>
          )}
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
}
