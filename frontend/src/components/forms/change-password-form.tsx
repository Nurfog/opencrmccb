"use client"

import { useState } from "react"
import { authApi } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"

export function ChangePasswordForm() {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    setError("")

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsMismatch"))
      return
    }

    setLoading(true)
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setMessage(t("auth.passwordChanged"))
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setError(err?.message ?? t("auth.changePasswordFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">{t("auth.changePassword")}</h3>

      {message && (
        <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
          {message}
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="slds-label" htmlFor="currentPassword">
          {t("auth.currentPassword")}
        </label>
        <input
          id="currentPassword"
          type="password"
          className="slds-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="slds-label" htmlFor="newPassword">
          {t("auth.newPassword")}
        </label>
        <input
          id="newPassword"
          type="password"
          className="slds-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="slds-label" htmlFor="confirmPassword">
          {t("auth.confirmNewPassword")}
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="slds-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="slds-btn slds-btn--brand">
        {loading ? t("auth.changing") : t("auth.changePassword")}
      </button>
    </form>
  )
}
