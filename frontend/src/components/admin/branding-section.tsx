"use client"

import { useState, useEffect, useCallback } from "react"
import { Save } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { adminApi, type Branding } from "@/lib/api"

export function BrandingSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [branding, setBranding] = useState<Branding | null>(null)
  const [bName, setBName] = useState("")
  const [bLogo, setBLogo] = useState("")
  const [bPrimary, setBPrimary] = useState("#2563eb")
  const [bSecondary, setBSecondary] = useState("#1e40af")
  const [bAccent, setBAccent] = useState("#10b981")
  const [bDomain, setBDomain] = useState("")
  const [bSaving, setBSaving] = useState(false)

  const fetchBranding = useCallback(async () => {
    try {
      const b = await adminApi.getBranding()
      setBranding(b)
      setBName(b.company_name ?? "")
      setBLogo(b.logo_url ?? "")
      setBPrimary(b.primary_color ?? "#2563eb")
      setBSecondary(b.secondary_color ?? "#1e40af")
      setBAccent(b.accent_color ?? "#10b981")
      setBDomain(b.custom_domain ?? "")
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchBranding() }, [fetchBranding])

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    setBSaving(true)
    try {
      await adminApi.updateBranding({
        company_name: bName || undefined, logo_url: bLogo || undefined,
        primary_color: bPrimary, secondary_color: bSecondary, accent_color: bAccent,
        custom_domain: bDomain || undefined,
      })
      success(t("admin.brandingSaved"))
      fetchBranding()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    } finally { setBSaving(false) }
  }

  return (
    <form onSubmit={handleSaveBranding} className="space-y-6 max-w-lg">
      <p className="text-sm text-muted-foreground">{t("admin.customizeAppearance")}</p>
      <div>
        <label className="slds-label">{t("admin.companyName")}</label>
        <input className="slds-input" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Mi Empresa" />
      </div>
      <div>
        <label className="slds-label">{t("admin.logoUrl")}</label>
        <input className="slds-input" value={bLogo} onChange={(e) => setBLogo(e.target.value)} placeholder="https://ejemplo.cl/logo.png" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="slds-label">{t("admin.primaryColor")}</label>
          <div className="flex items-center gap-2">
            <input type="color" className="w-10 h-10 rounded border cursor-pointer" value={bPrimary} onChange={(e) => setBPrimary(e.target.value)} />
            <input className="slds-input font-mono text-xs" value={bPrimary} onChange={(e) => setBPrimary(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="slds-label">{t("admin.secondaryColor")}</label>
          <div className="flex items-center gap-2">
            <input type="color" className="w-10 h-10 rounded border cursor-pointer" value={bSecondary} onChange={(e) => setBSecondary(e.target.value)} />
            <input className="slds-input font-mono text-xs" value={bSecondary} onChange={(e) => setBSecondary(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="slds-label">{t("admin.accentColor")}</label>
          <div className="flex items-center gap-2">
            <input type="color" className="w-10 h-10 rounded border cursor-pointer" value={bAccent} onChange={(e) => setBAccent(e.target.value)} />
            <input className="slds-input font-mono text-xs" value={bAccent} onChange={(e) => setBAccent(e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label className="slds-label">{t("admin.customDomain")}</label>
        <input className="slds-input" value={bDomain} onChange={(e) => setBDomain(e.target.value)} placeholder="crm.miempresa.cl" />
      </div>
      <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: bPrimary }}>
          <span className="text-white text-lg font-bold">{bName.charAt(0) || "O"}</span>
        </div>
        <div>
          <p className="text-sm font-semibold">{bName || "OpenCRM"}</p>
          <p className="text-xs text-muted-foreground">{t("admin.brandingPreview")}</p>
        </div>
      </div>
      <button type="submit" disabled={bSaving} className="slds-btn slds-btn--brand flex items-center gap-2">
        <Save className="h-4 w-4" />
        {bSaving ? t("common.saving") : t("admin.saveBranding")}
      </button>
    </form>
  )
}
