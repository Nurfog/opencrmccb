"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, ArrowRightLeft, Building2, User, Briefcase, Plus, Check, X, Calendar, Mail, Phone, Globe, Tag } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { leadsApi, type Lead, type LeadActivity } from "@/lib/api"
import { LeadForm } from "@/components/forms/lead-form"
import { ConvertLeadDialog } from "@/components/forms/convert-lead-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TagsInput } from "@/components/ui/tags-input"
import { formatDate, cn } from "@/lib/utils"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  qualified: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  unqualified: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  converted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  recycled: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
}

const SOURCE_LABELS: Record<string, string> = {
  web: "Web",
  referral: "Referral",
  cold_call: "Cold Call",
  advertisement: "Advertisement",
  email: "Email",
  social: "Social",
  partner: "Partner",
  event: "Event",
  other: "Other",
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const { success, error } = useToast()

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Activity form
  const [activityFormOpen, setActivityFormOpen] = useState(false)
  const [activityType, setActivityType] = useState("call")
  const [activitySubject, setActivitySubject] = useState("")
  const [activityDescription, setActivityDescription] = useState("")
  const [activityLoading, setActivityLoading] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      const res = await leadsApi.get(id as string)
      setLead(res)
    } catch {
      router.push("/leads")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await leadsApi.getActivities(id as string)
      setActivities(res)
    } catch {}
  }, [id])

  useEffect(() => {
    fetchLead()
    fetchActivities()
  }, [fetchLead, fetchActivities])

  const handleDelete = async () => {
    if (!lead) return
    try {
      await leadsApi.delete(lead.id)
      success(t("toast.deleted", { entity: t("leads.title") }))
      router.push("/leads")
    } catch {
      error(t("toast.error", { action: "delete", entity: t("leads.title") }))
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return
    try {
      await leadsApi.update(lead.id, { status: newStatus as Lead["status"] })
      setLead({ ...lead, status: newStatus })
      success(t("toast.updated", { entity: t("leads.status") }))
    } catch {
      error(t("toast.error", { action: "update", entity: t("leads.status") }))
    }
  }

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lead) return
    setActivityLoading(true)

    try {
      await leadsApi.createActivity(lead.id, {
        type: activityType,
        subject: activitySubject,
        description: activityDescription || undefined,
      })
      setActivitySubject("")
      setActivityDescription("")
      setActivityFormOpen(false)
      fetchActivities()
      success(t("toast.created", { entity: t("activities.title") }))
    } catch {
      error(t("toast.error", { action: "create", entity: t("activities.title") }))
    } finally {
      setActivityLoading(false)
    }
  }

  const handleCompleteActivity = async (activityId: string) => {
    if (!lead) return
    try {
      await leadsApi.completeActivity(lead.id, activityId)
      fetchActivities()
    } catch {
      error(t("toast.error", { action: "complete", entity: t("activities.title") }))
    }
  }

  const handleDeleteActivity = async (activityId: string) => {
    if (!lead) return
    try {
      await leadsApi.deleteActivity(lead.id, activityId)
      fetchActivities()
    } catch {
      error(t("toast.error", { action: "delete", entity: t("activities.title") }))
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400"
    if (score >= 20) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!lead) return null

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/leads")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lead.first_name} {lead.last_name}
              </h1>
              <span className={cn("px-2.5 py-0.5 text-xs font-semibold rounded-full", STATUS_COLORS[lead.status])}>
                {lead.status}
              </span>
            </div>
            {lead.company_name && (
              <p className="text-gray-500 dark:text-gray-400">{lead.company_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lead.status !== "converted" && (
              <button
                onClick={() => setConvertOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {t("leads.convert")}
              </button>
            )}
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              {t("common.edit")}
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t("common.details")}</h2>
              <div className="grid grid-cols-2 gap-4">
                {lead.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.email")}</div>
                      <div className="text-sm text-gray-900 dark:text-white">{lead.email}</div>
                    </div>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.phone")}</div>
                      <div className="text-sm text-gray-900 dark:text-white">{lead.phone}</div>
                    </div>
                  </div>
                )}
                {lead.title && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.jobTitle")}</div>
                      <div className="text-sm text-gray-900 dark:text-white">{lead.title}</div>
                    </div>
                  </div>
                )}
                {lead.industry && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.industry")}</div>
                      <div className="text-sm text-gray-900 dark:text-white">{lead.industry}</div>
                    </div>
                  </div>
                )}
                {lead.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.website")}</div>
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                        {lead.website}
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.source")}</div>
                    <div className="text-sm text-gray-900 dark:text-white">{t(`leads.sources.${lead.lead_source}`)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t("leads.created")}</div>
                    <div className="text-sm text-gray-900 dark:text-white">{formatDate(lead.created_at)}</div>
                  </div>
                </div>
              </div>
              {lead.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t("leads.notes")}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lead.notes}</div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t("common.tags")}</h2>
              <TagsInput entityType="lead" entityId={id} />
            </div>

            {/* Converted Info */}
            {lead.status === "converted" && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
                <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-3">{t("leads.converted")}</h2>
                <div className="space-y-2">
                  {lead.converted_contact_id && (
                    <Link href={`/contacts/${lead.converted_contact_id}`} className="flex items-center gap-2 text-purple-700 dark:text-purple-300 hover:underline">
                      <User className="w-4 h-4" />
                      {t("leads.viewContact")}
                    </Link>
                  )}
                  {lead.converted_company_id && (
                    <Link href={`/companies/${lead.converted_company_id}`} className="flex items-center gap-2 text-purple-700 dark:text-purple-300 hover:underline">
                      <Building2 className="w-4 h-4" />
                      {t("leads.viewCompany")}
                    </Link>
                  )}
                  {lead.converted_deal_id && (
                    <Link href={`/deals/${lead.converted_deal_id}`} className="flex items-center gap-2 text-purple-700 dark:text-purple-300 hover:underline">
                      <Briefcase className="w-4 h-4" />
                      {t("leads.viewDeal")}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Activities */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("leads.activities")}</h2>
                <button
                  onClick={() => setActivityFormOpen(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-4 h-4" />
                  {t("leads.addActivity")}
                </button>
              </div>

              {activityFormOpen && (
                <form onSubmit={handleCreateActivity} className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                    >
                      <option value="call">{t("activities.call")}</option>
                      <option value="email">{t("activities.email")}</option>
                      <option value="meeting">{t("activities.meeting")}</option>
                      <option value="note">{t("activities.note")}</option>
                      <option value="task">{t("activities.task")}</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder={t("leads.activitySubject")}
                      value={activitySubject}
                      onChange={(e) => setActivitySubject(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                    />
                  </div>
                  <textarea
                    placeholder={t("leads.activityDescription")}
                    rows={2}
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={activityLoading}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {activityLoading ? t("leads.activitySaving") : t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityFormOpen(false)}
                      className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              )}

              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t("leads.noActivities")}</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className={cn("flex items-start gap-3 p-3 rounded-lg", act.completed ? "bg-gray-50 dark:bg-gray-900/30" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700")}>
                      <button
                        onClick={() => !act.completed && handleCompleteActivity(act.id)}
                        className={cn("mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", act.completed ? "bg-green-500 border-green-500" : "border-gray-300 dark:border-gray-600 hover:border-green-500")}
                      >
                        {act.completed && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                            {act.type}
                          </span>
                          <span className={cn("text-sm font-medium", act.completed ? "text-gray-500 line-through" : "text-gray-900 dark:text-white")}>
                            {act.subject}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{act.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteActivity(act.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Score */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t("leads.leadScore")}</h3>
              <div className={cn("text-4xl font-bold", getScoreColor(lead.score))}>
                {lead.score}
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={cn("h-2 rounded-full", lead.score >= 80 ? "bg-green-500" : lead.score >= 50 ? "bg-yellow-500" : lead.score >= 20 ? "bg-orange-500" : "bg-red-500")}
                  style={{ width: `${lead.score}%` }}
                />
              </div>
            </div>

            {/* Quick Status Change */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t("leads.status")}</h3>
              <div className="space-y-2">
                {["new", "contacted", "qualified", "unqualified", "recycled"].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={lead.status === status}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      lead.status === status
                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {t(`leads.statuses.${status}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t("common.meta")}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("leads.created")}</span>
                  <span className="text-gray-900 dark:text-white">{formatDate(lead.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("leads.updated")}</span>
                  <span className="text-gray-900 dark:text-white">{formatDate(lead.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <LeadForm
        open={formOpen}
        lead={lead}
        onClose={() => setFormOpen(false)}
        onSuccess={() => { setFormOpen(false); fetchLead() }}
      />

      <ConvertLeadDialog
        open={convertOpen}
        lead={lead}
        onClose={() => setConvertOpen(false)}
        onSuccess={() => { setConvertOpen(false); fetchLead() }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("leads.deleteLead")}
        message={t("leads.deleteLeadMessage", { name: `${lead.first_name} ${lead.last_name}` })}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </AppLayout>
  )
}
