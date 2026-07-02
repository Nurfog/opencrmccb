"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, Plus, Calendar, DollarSign, Phone, Mail, User, Building2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { dealsApi, contactsApi, companiesApi, type Deal, type Contact, type Company, type Activity } from "@/lib/api"
import { DealForm } from "@/components/forms/deal-form"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TagsInput } from "@/components/ui/tags-input"
import { formatDate, formatCurrency, cn } from "@/lib/utils"

type Tab = "overview" | "activities"

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const { success, error } = useToast()

  const [deal, setDeal] = useState<Deal | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const dealData = await dealsApi.get(id)
        setDeal(dealData)

        const [activitiesData] = await Promise.all([
          dealsApi.getActivities(id),
        ])
        setActivities(activitiesData)

        if (dealData.contact_id) {
          try {
            const contactData = await contactsApi.get(dealData.contact_id)
            setContact(contactData)
          } catch {
            // Contact might have been deleted
          }
        }

        if (dealData.company_id) {
          try {
            const companyData = await companiesApi.get(dealData.company_id)
            setCompany(companyData)
          } catch {
            // Company might have been deleted
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : t("common.error"))
        router.push("/deals")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router, error])

  const handleUpdate = async (formData: Record<string, unknown>) => {
    try {
      await dealsApi.update(id, formData as Partial<Deal>)
      success(t("toast.updated", { entity: t("deals.title") }))
      setFormOpen(false)
      const updated = await dealsApi.get(id)
      setDeal(updated)
    } catch (err) {
      error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  const handleDelete = async () => {
    try {
      await dealsApi.delete(id)
      success(t("toast.deleted", { entity: t("deals.title") }))
      router.push("/deals")
    } catch (err) {
      error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-fade-in space-y-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </AppLayout>
    )
  }

  if (!deal) return null

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "overview", label: t("common.overview"), count: 0 },
    { id: "activities", label: t("activities.title"), count: activities.length },
  ]

  const stageColors: Record<string, string> = {
    prospecting: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    qualification: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    proposal: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    negotiation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    closed_won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    closed_lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/deals")}
            className="slds-btn slds-btn--icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="slds-header__title">{deal.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("px-2 py-1 text-xs rounded-full", stageColors[deal.stage] || "bg-gray-100 text-gray-800")}>
                {t(`stages.${deal.stage}` as any) || deal.stage}
              </span>
              <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFormOpen(true)} className="slds-btn slds-btn--neutral flex items-center gap-2">
              <Edit className="h-4 w-4" />
              {t("common.edit")}
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="slds-btn slds-btn--neutral text-red-500 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-muted">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deal Info */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.details")}</h3>
              <dl className="space-y-4">
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground w-32">
                    <DollarSign className="h-4 w-4" />
                    {t("deals.value")}
                  </dt>
                  <dd className="text-lg font-semibold">{formatCurrency(deal.value, deal.currency)}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground w-32">
                    <Calendar className="h-4 w-4" />
                    {t("deals.expectedCloseDate")}
                  </dt>
                  <dd>{deal.expected_close_date ? formatDate(deal.expected_close_date || "") : "-"}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground w-32">
                    <Calendar className="h-4 w-4" />
                    {t("common.createdAt")}
                  </dt>
                  <dd>{formatDate(deal.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Related Records */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.related")}</h3>
              <dl className="space-y-4">
                {contact && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <User className="h-4 w-4" />
                      {t("contacts.title")}
                    </dt>
                    <dd>
                      <a href={`/contacts/${contact.id}`} className="text-brand hover:underline">
                        {contact.first_name} {contact.last_name}
                      </a>
                    </dd>
                  </div>
                )}
                {company && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Building2 className="h-4 w-4" />
                      {t("companies.title")}
                    </dt>
                    <dd>
                      <a href={`/companies/${company.id}`} className="text-brand hover:underline">
                        {company.name}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Notes */}
            {deal.notes && (
              <div className="slds-card p-6">
                <h3 className="text-lg font-semibold mb-4">{t("common.notes")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}

            {/* Tags */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.tags")}</h3>
              <TagsInput entityType="deal" entityId={id} />
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div className="slds-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("activities.title")}</h3>
            </div>
            {activities.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("deals.noActivities")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-start gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      activity.completed ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                    )}>
                      {activity.activity_type === "call" ? <Phone className="h-4 w-4" /> :
                       activity.activity_type === "email" ? <Mail className="h-4 w-4" /> :
                       <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{activity.subject}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {activity.activity_type} • {formatDate(activity.due_date || "")}
                      </p>
                    </div>
                    {activity.completed && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {t("activities.completed")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DealForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleUpdate}
        initialData={deal}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("deals.deleteDeal")}
        message={t("deals.deleteDealMessage", { name: deal.title })}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
