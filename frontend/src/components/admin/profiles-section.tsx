"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { adminApi, type Profile } from "@/lib/api"
import { Modal } from "@/components/ui/modal"

const AVAILABLE_PERMISSIONS = [
  "contacts.view", "contacts.create", "contacts.edit", "contacts.delete",
  "companies.view", "companies.create", "companies.edit", "companies.delete",
  "deals.view", "deals.create", "deals.edit", "deals.delete",
  "activities.view", "activities.create", "activities.edit", "activities.delete",
  "reports.view",
  "settings.view", "settings.edit",
  "admin.access",
]

export function ProfilesSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profModal, setProfModal] = useState(false)
  const [editingProf, setEditingProf] = useState<Profile | null>(null)
  const [profName, setProfName] = useState("")
  const [profDesc, setProfDesc] = useState("")
  const [profPerms, setProfPerms] = useState<string[]>([])

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await adminApi.listProfiles()
      setProfiles(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const openProfForm = (p?: Profile) => {
    setEditingProf(p ?? null)
    setProfName(p?.name ?? "")
    setProfDesc(p?.description ?? "")
    setProfPerms(p?.permissions ?? [])
    setProfModal(true)
  }

  const handleSaveProf = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingProf) {
        await adminApi.updateProfile(editingProf.id, { name: profName, description: profDesc || undefined, permissions: profPerms })
        success(t("admin.profileUpdated"))
      } else {
        await adminApi.createProfile({ name: profName, description: profDesc || undefined, permissions: profPerms })
        success(t("admin.profileCreated"))
      }
      setProfModal(false)
      fetchProfiles()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const togglePerm = (perm: string) => {
    setProfPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm])
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{t("admin.manageProfiles")}</p>
          <button type="button" onClick={() => openProfForm()} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t("admin.newProfile")}
          </button>
        </div>
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  {p.is_system && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">{t("admin.system")}</span>}
                </div>
                {!p.is_system && (
                  <button type="button" onClick={() => openProfForm(p)} className="slds-btn slds-btn--icon"><Edit className="h-4 w-4" /></button>
                )}
              </div>
              {p.description && <p className="text-xs text-muted-foreground mb-2">{p.description}</p>}
              <div className="flex flex-wrap gap-1">
                {p.permissions.map(perm => (
                  <span key={perm} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">{perm}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={profModal} onClose={() => setProfModal(false)} title={editingProf ? t("admin.editProfile") : t("admin.newProfile")} size="lg">
        <form onSubmit={handleSaveProf} className="space-y-4">
          <div>
            <label className="slds-label">{t("admin.profileName")}</label>
            <input className="slds-input" value={profName} onChange={(e) => setProfName(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label">{t("admin.profileDescription")}</label>
            <textarea className="slds-input min-h-[60px]" value={profDesc} onChange={(e) => setProfDesc(e.target.value)} />
          </div>
          <div>
            <label className="slds-label mb-2">{t("admin.permissions")}</label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {AVAILABLE_PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-sm">
                  <input type="checkbox" checked={profPerms.includes(perm)} onChange={() => togglePerm(perm)} className="rounded" />
                  {perm}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setProfModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" className="slds-btn slds-btn--brand">{t("common.save")}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
