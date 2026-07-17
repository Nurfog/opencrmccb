"use client"

import { useState, useEffect, useCallback } from "react"
import { GitBranch, Users, Palette, Plus, Edit, Trash2, Save, X, Check, UserCog, Webhook, ExternalLink, RotateCw } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { adminApi, usersApi, webhooksApi, type PipelineWithStages, type PipelineStage, type Profile, type Branding, type User, type Webhook as WebhookType, type WebhookDelivery } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type AdminTab = "pipelines" | "profiles" | "branding" | "users" | "webhooks"

const AVAILABLE_PERMISSIONS = [
  "contacts.view", "contacts.create", "contacts.edit", "contacts.delete",
  "companies.view", "companies.create", "companies.edit", "companies.delete",
  "deals.view", "deals.create", "deals.edit", "deals.delete",
  "activities.view", "activities.create", "activities.edit", "activities.delete",
  "reports.view",
  "settings.view", "settings.edit",
  "admin.access",
]

export default function AdminPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [activeTab, setActiveTab] = useState<AdminTab>("pipelines")

  // ─── Pipelines ───
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([])
  const [pipeModal, setPipeModal] = useState(false)
  const [editingPipe, setEditingPipe] = useState<PipelineWithStages | null>(null)
  const [pipeName, setPipeName] = useState("")
  const [pipeSlug, setPipeSlug] = useState("")
  const [pipeDesc, setPipeDesc] = useState("")
  const [pipeType, setPipeType] = useState("person")
  const [newStageNames, setNewStageNames] = useState<Record<string, string>>({})

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await adminApi.listPipelines()
      setPipelines(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (activeTab === "pipelines") fetchPipelines() }, [activeTab, fetchPipelines])

  const openPipeForm = (p?: PipelineWithStages) => {
    setEditingPipe(p ?? null)
    setPipeName(p?.pipeline.name ?? "")
    setPipeSlug(p?.pipeline.slug ?? "")
    setPipeDesc(p?.pipeline.description ?? "")
    setPipeType(p?.pipeline.entity_type ?? "person")
    setPipeModal(true)
  }

  const handleSavePipe = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPipe) {
        await adminApi.updatePipeline(editingPipe.pipeline.id, { name: pipeName, slug: pipeSlug, description: pipeDesc || undefined, entity_type: pipeType })
        success(t("admin.pipelineUpdated"))
      } else {
        await adminApi.createPipeline({ name: pipeName, slug: pipeSlug, description: pipeDesc || undefined, entity_type: pipeType })
        success(t("admin.pipelineCreated"))
      }
      setPipeModal(false)
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeletePipe = async (id: string) => {
    try {
      await adminApi.deletePipeline(id)
      success(t("admin.pipelineDeleted"))
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleAddStage = async (pipelineId: string, stages: PipelineStage[]) => {
    const name = newStageNames[pipelineId] ?? ""
    if (!name.trim()) return
    try {
      await adminApi.createStage(pipelineId, { name, position: stages.length })
      setNewStageNames(prev => ({ ...prev, [pipelineId]: "" }))
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  // ─── Profiles ───
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

  useEffect(() => { if (activeTab === "profiles") fetchProfiles() }, [activeTab, fetchProfiles])

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

  // ─── Users ───
  const [users, setUsers] = useState<User[]>([])
  const [userProfiles, setUserProfiles] = useState<Profile[]>([])
  const [assignModal, setAssignModal] = useState(false)
  const [assigningUser, setAssigningUser] = useState<User | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState("")

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.list()
      setUsers(res)
    } catch { /* ignore */ }
  }, [])

  const fetchUserProfiles = useCallback(async () => {
    try {
      const res = await adminApi.listProfiles()
      setUserProfiles(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (activeTab === "users") { fetchUsers(); fetchUserProfiles(); } }, [activeTab, fetchUsers, fetchUserProfiles])

  const openAssignModal = (user: User) => {
    setAssigningUser(user)
    setSelectedProfileId(user.profile_id ?? "")
    setAssignModal(true)
  }

  const handleAssignProfile = async () => {
    if (!assigningUser || !selectedProfileId) return
    try {
      await usersApi.updateProfile(assigningUser.id, selectedProfileId)
      success(t("admin.profileAssigned"))
      setAssignModal(false)
      fetchUsers()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeleteUser = async (id: string) => {
    try {
      await usersApi.delete(id)
      success(t("admin.userDeleted"))
      fetchUsers()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  // ─── Branding ───
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

  useEffect(() => { if (activeTab === "branding") fetchBranding() }, [activeTab, fetchBranding])

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

  // ─── Webhooks ───
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [whModal, setWhModal] = useState(false)
  const [whUrl, setWhUrl] = useState("")
  const [whEvent, setWhEvent] = useState("contact_created")
  const [whSecret, setWhSecret] = useState("")
  const [deliveriesModal, setDeliveriesModal] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<WebhookType | null>(null)

  const WEBHOOK_EVENTS = [
    "contact_created", "contact_updated", "contact_deleted",
    "deal_created", "deal_updated", "deal_deleted",
  ]

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await webhooksApi.list()
      setWebhooks(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (activeTab === "webhooks") fetchWebhooks() }, [activeTab, fetchWebhooks])

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await webhooksApi.create({ url: whUrl, event: whEvent, secret: whSecret || undefined })
      success(t("admin.webhookCreated"))
      setWhModal(false)
      setWhUrl("")
      setWhSecret("")
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleToggleWebhook = async (wh: WebhookType) => {
    try {
      await webhooksApi.update(wh.id, { active: !wh.active })
      success(wh.active ? t("admin.webhookDisabled") : t("admin.webhookEnabled"))
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    try {
      await webhooksApi.delete(id)
      success(t("admin.webhookDeleted"))
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const openDeliveries = async (wh: WebhookType) => {
    setDeliveriesWebhook(wh)
    try {
      const res = await webhooksApi.listDeliveries(wh.id)
      setDeliveries(res)
    } catch { setDeliveries([]) }
    setDeliveriesModal(true)
  }

  const tabs = [
    { id: "pipelines" as AdminTab, label: t("admin.pipelines"), icon: GitBranch },
    { id: "profiles" as AdminTab, label: t("admin.profiles"), icon: Users },
    { id: "users" as AdminTab, label: t("admin.users"), icon: UserCog },
    { id: "branding" as AdminTab, label: t("admin.branding"), icon: Palette },
    { id: "webhooks" as AdminTab, label: t("admin.webhooks"), icon: Webhook },
  ]

  return (
    <ProtectedRoute requiredPermission="admin.access">
      <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("admin.title")}</h1>
            <p className="slds-header__description">{t("admin.description")}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="slds-card p-6">
          {/* ─── PIPELINES ─── */}
          {activeTab === "pipelines" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{t("admin.managePipelines")}</p>
                <button type="button" onClick={() => openPipeForm()} className="slds-btn slds-btn--brand flex items-center gap-2">
                  <Plus className="h-4 w-4" /> {t("admin.newPipeline")}
                </button>
              </div>
              <div className="space-y-4">
                {pipelines.map(pw => (
                  <div key={pw.pipeline.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{pw.pipeline.name}</h3>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                            pw.pipeline.entity_type === "person" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          )}>
                            {pw.pipeline.entity_type === "person" ? t("admin.person") : t("admin.company")}
                          </span>
                          {pw.pipeline.is_default && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">{t("admin.default")}</span>}
                        </div>
                        {pw.pipeline.description && <p className="text-xs text-muted-foreground mt-0.5">{pw.pipeline.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openPipeForm(pw)} className="slds-btn slds-btn--icon"><Edit className="h-4 w-4" /></button>
                        {!pw.pipeline.is_default && (
                          <button type="button" onClick={() => handleDeletePipe(pw.pipeline.id)} className="slds-btn slds-btn--icon text-red-500"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pw.stages.map(s => (
                        <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                          style={{ borderColor: s.color ?? '#6B7280', color: s.color ?? '#6B7280' }}>
                          <span>{s.name}</span>
                          {s.probability != null && <span className="opacity-60">({s.probability}%)</span>}
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <input className="w-28 px-2 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs bg-transparent"
                          value={newStageNames[pw.pipeline.id] ?? ""} onChange={(e) => setNewStageNames(prev => ({ ...prev, [pw.pipeline.id]: e.target.value }))}
                          placeholder={t("admin.addStage")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStage(pw.pipeline.id, pw.stages) } }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── PROFILES ─── */}
          {activeTab === "profiles" && (
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
          )}

          {/* ─── USERS ─── */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{t("admin.manageUsers")}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userName")}</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userEmail")}</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userProfile")}</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userPermissions")}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                        <td className="py-3 px-4">
                          <div className="font-medium">{u.first_name} {u.last_name}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-4">
                          {userProfiles.find(p => p.id === u.profile_id)?.name ?? (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(u.permissions ?? []).slice(0, 3).map(perm => (
                              <span key={perm} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">{perm}</span>
                            ))}
                            {(u.permissions ?? []).length > 3 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">+{(u.permissions ?? []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openAssignModal(u)} className="slds-btn slds-btn--icon" title={t("admin.assignProfile")}>
                              <Edit className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDeleteUser(u.id)} className="slds-btn slds-btn--icon text-red-500" title={t("common.delete")}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── BRANDING ─── */}
          {activeTab === "branding" && (
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
          )}

          {/* ─── WEBHOOKS ─── */}
          {activeTab === "webhooks" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{t("admin.manageWebhooks")}</p>
                <button type="button" onClick={() => setWhModal(true)} className="slds-btn slds-btn--brand flex items-center gap-2">
                  <Plus className="h-4 w-4" /> {t("admin.newWebhook")}
                </button>
              </div>
              {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.noWebhooks")}</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map(wh => (
                    <div key={wh.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                            wh.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {wh.active ? t("common.active") : t("common.inactive")}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                            {wh.event}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleToggleWebhook(wh)} className="slds-btn slds-btn--icon" title={wh.active ? t("common.disable") : t("common.enable")}>
                            {wh.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button type="button" onClick={() => openDeliveries(wh)} className="slds-btn slds-btn--icon" title={t("admin.viewDeliveries")}>
                            <RotateCw className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteWebhook(wh.id)} className="slds-btn slds-btn--icon text-red-500" title={t("common.delete")}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        <code className="truncate max-w-md">{wh.url}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline modal */}
      <Modal isOpen={pipeModal} onClose={() => setPipeModal(false)} title={editingPipe ? t("admin.editPipeline") : t("admin.newPipeline")}>
        <form onSubmit={handleSavePipe} className="space-y-4">
          <div>
            <label className="slds-label">{t("admin.pipelineName")}</label>
            <input className="slds-input" value={pipeName} onChange={(e) => setPipeName(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label">{t("admin.pipelineSlug")}</label>
            <input className="slds-input font-mono" value={pipeSlug} onChange={(e) => setPipeSlug(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label">{t("admin.pipelineDescription")}</label>
            <textarea className="slds-input min-h-[60px]" value={pipeDesc} onChange={(e) => setPipeDesc(e.target.value)} />
          </div>
          <div>
            <label className="slds-label">{t("admin.entityType")}</label>
            <select className="slds-input" value={pipeType} onChange={(e) => setPipeType(e.target.value)}>
              <option value="person">{t("admin.person")}</option>
              <option value="company">{t("admin.company")}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPipeModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" className="slds-btn slds-btn--brand">{t("common.save")}</button>
          </div>
        </form>
      </Modal>

      {/* Profile modal */}
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

      {/* User Profile Assignment Modal */}
      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title={t("admin.assignProfile")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.assignProfileTo")} <strong>{assigningUser?.first_name} {assigningUser?.last_name}</strong>
          </p>
          <select
            className="slds-input"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            <option value="">{t("admin.selectProfile")}</option>
            {userProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAssignModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="button" onClick={handleAssignProfile} disabled={!selectedProfileId} className="slds-btn slds-btn--brand">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      {/* Create Webhook Modal */}
      <Modal isOpen={whModal} onClose={() => setWhModal(false)} title={t("admin.newWebhook")}>
        <form onSubmit={handleCreateWebhook} className="space-y-4">
          <div>
            <label className="slds-label">{t("admin.webhookUrl")}</label>
            <input className="slds-input font-mono" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://example.com/webhook" required />
          </div>
          <div>
            <label className="slds-label">{t("admin.webhookEvent")}</label>
            <select className="slds-input" value={whEvent} onChange={(e) => setWhEvent(e.target.value)}>
              {WEBHOOK_EVENTS.map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="slds-label">{t("admin.webhookSecret")} <span className="text-muted-foreground">({t("common.optional")})</span></label>
            <input className="slds-input font-mono" value={whSecret} onChange={(e) => setWhSecret(e.target.value)} placeholder="HMAC-SHA256 secret" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setWhModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" className="slds-btn slds-btn--brand">{t("common.create")}</button>
          </div>
        </form>
      </Modal>

      {/* Deliveries Modal */}
      <Modal isOpen={deliveriesModal} onClose={() => setDeliveriesModal(false)} title={`${t("admin.deliveries")} — ${deliveriesWebhook?.event ?? ""}`} size="lg">
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noDeliveries")}</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.status")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.attempts")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.responseCode")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        d.status === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                        d.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                        d.status === "processing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">{d.attempts}</td>
                    <td className="py-2 px-3 font-mono">{d.response_status ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppLayout>
    </ProtectedRoute>
  )
}
