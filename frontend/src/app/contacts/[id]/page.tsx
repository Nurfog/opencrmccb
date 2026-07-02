"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, Plus, Calendar, DollarSign, Phone, Mail, Building2, Briefcase, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { contactsApi, dealsApi, activitiesApi, type Contact, type Deal, type Activity } from "@/lib/api"
import { ContactForm } from "@/components/forms/contact-form"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TagsInput } from "@/components/ui/tags-input"
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils"

type Tab = "overview" | "deals" | "activities"

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const { success, error } = useToast()

  const [contact, setContact] = useState<Contact | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [contactData, dealsData, activitiesData] = await Promise.all([
          contactsApi.get(id),
          contactsApi.getDeals(id),
          contactsApi.getActivities(id),
        ])
        setContact(contactData)
        setDeals(dealsData)
        setActivities(activitiesData)
      } catch (err) {
        error(err instanceof Error ? err.message : t("common.error"))
        router.push("/contacts")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router, error])

  const handleUpdate = async (formData: Record<string, unknown>) => {
    try {
      await contactsApi.update(id, formData as Partial<Contact>)
      success(t("toast.updated", { entity: t("contacts.title") }))
      setFormOpen(false)
      const updated = await contactsApi.get(id)
      setContact(updated)
    } catch (err) {
      error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  const handleDelete = async () => {
    try {
      await contactsApi.delete(id)
      success(t("toast.deleted", { entity: t("contacts.title") }))
      router.push("/contacts")
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

  if (!contact) return null

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "overview", label: t("common.overview"), count: 0 },
    { id: "deals", label: t("deals.title"), count: deals.length },
    { id: "activities", label: t("activities.title"), count: activities.length },
  ]

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/contacts")}
            className="slds-btn slds-btn--icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white font-medium">
                {getInitials(`${contact.first_name} ${contact.last_name}`)}
              </div>
              <div>
                <h1 className="slds-header__title">{contact.first_name} {contact.last_name}</h1>
                <p className="slds-header__description">{contact.position || t("contacts.noPosition")}</p>
              </div>
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
            {/* Contact Info */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.details")}</h3>
              <dl className="space-y-4">
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Mail className="h-4 w-4" />
                      {t("contacts.email")}
                    </dt>
                    <dd>
                      <a href={`mailto:${contact.email}`} className="text-brand hover:underline">
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Phone className="h-4 w-4" />
                      {t("contacts.phone")}
                    </dt>
                    <dd>
                      <a href={`tel:${contact.phone}`} className="text-brand hover:underline">
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.position && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Briefcase className="h-4 w-4" />
                      {t("contacts.position")}
                    </dt>
                    <dd>{contact.position}</dd>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground w-32">
                    <Calendar className="h-4 w-4" />
                    {t("common.createdAt")}
                  </dt>
                  <dd>{formatDate(contact.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Notes */}
            {contact.notes && (
              <div className="slds-card p-6">
                <h3 className="text-lg font-semibold mb-4">{t("common.notes")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}

            {/* Summary Cards */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.summary")}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{deals.length}</p>
                  <p className="text-sm text-muted-foreground">{t("deals.title")}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{activities.length}</p>
                  <p className="text-sm text-muted-foreground">{t("activities.title")}</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.tags")}</h3>
              <TagsInput entityType="contact" entityId={id} />
            </div>
          </div>
        )}

        {activeTab === "deals" && (
          <div className="slds-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("deals.title")}</h3>
            </div>
            {deals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("contacts.noDeals")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th>{t("deals.dealName")}</th>
                      <th>{t("deals.value")}</th>
                      <th>{t("deals.stage")}</th>
                      <th>{t("deals.expectedCloseDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <tr key={deal.id}>
                        <td className="font-medium">{deal.title}</td>
                        <td>{formatCurrency(deal.value, deal.currency)}</td>
                        <td>
                          <span className={cn(
                            "px-2 py-1 text-xs rounded-full",
                            deal.stage === "closed_won" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            deal.stage === "closed_lost" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          )}>
                            {t(`stages.${deal.stage}` as any) || deal.stage}
                          </span>
                        </td>
                        <td>{deal.expected_close_date ? formatDate(deal.expected_close_date || "") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "activities" && (
          <div className="slds-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("activities.title")}</h3>
            </div>
            {activities.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("contacts.noActivities")}
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

      <ContactForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleUpdate}
        initialData={contact}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("contacts.deleteContact")}
        message={t("contacts.deleteContactMessage", { name: `${contact.first_name} ${contact.last_name}` })}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
