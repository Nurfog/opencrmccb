"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, Plus, Calendar, DollarSign, Phone, Mail, Globe, MapPin, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { companiesApi, type Company, type Contact, type Deal } from "@/lib/api"
import { CompanyForm } from "@/components/forms/company-form"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TagsInput } from "@/components/ui/tags-input"
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils"

type Tab = "overview" | "contacts" | "deals"

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()
  const { success, error } = useToast()

  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [revenue, setRevenue] = useState<{ total_value: number; deal_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [companyData, contactsData, dealsData, revenueData] = await Promise.all([
          companiesApi.get(id),
          companiesApi.getContacts(id),
          companiesApi.getDeals(id),
          companiesApi.getRevenue(id),
        ])
        setCompany(companyData)
        setContacts(contactsData)
        setDeals(dealsData)
        setRevenue(revenueData)
      } catch (err) {
        error(err instanceof Error ? err.message : t("common.error"))
        router.push("/companies")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, router, error])

  const handleUpdate = async (formData: Record<string, unknown>) => {
    try {
      await companiesApi.update(id, formData as Partial<Company>)
      success(t("toast.updated", { entity: t("companies.title") }))
      setFormOpen(false)
      const updated = await companiesApi.get(id)
      setCompany(updated)
    } catch (err) {
      error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  const handleDelete = async () => {
    try {
      await companiesApi.delete(id)
      success(t("toast.deleted", { entity: t("companies.title") }))
      router.push("/companies")
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

  if (!company) return null

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "overview", label: t("common.overview"), count: 0 },
    { id: "contacts", label: t("contacts.title"), count: contacts.length },
    { id: "deals", label: t("deals.title"), count: deals.length },
  ]

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/companies")}
            className="slds-btn slds-btn--icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="slds-header__title">{company.name}</h1>
            <p className="slds-header__description">{company.industry || t("companies.noIndustry")}</p>
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
            {/* Company Info */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.details")}</h3>
              <dl className="space-y-4">
                {company.email && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Mail className="h-4 w-4" />
                      {t("companies.email")}
                    </dt>
                    <dd>
                      <a href={`mailto:${company.email}`} className="text-brand hover:underline">
                        {company.email}
                      </a>
                    </dd>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Phone className="h-4 w-4" />
                      {t("companies.phone")}
                    </dt>
                    <dd>
                      <a href={`tel:${company.phone}`} className="text-brand hover:underline">
                        {company.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <Globe className="h-4 w-4" />
                      {t("companies.website")}
                    </dt>
                    <dd>
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        {company.website}
                      </a>
                    </dd>
                  </div>
                )}
                {(company.address || company.city || company.country) && (
                  <div className="flex items-center gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground w-32">
                      <MapPin className="h-4 w-4" />
                      {t("companies.address")}
                    </dt>
                    <dd>
                      {[company.address, company.city, company.country].filter(Boolean).join(", ")}
                    </dd>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground w-32">
                    <Calendar className="h-4 w-4" />
                    {t("common.createdAt")}
                  </dt>
                  <dd>{formatDate(company.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Revenue Summary */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("companies.revenue")}</h3>
              {revenue && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(revenue.total_value)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("companies.totalValue")}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{revenue.deal_count}</p>
                    <p className="text-sm text-muted-foreground">{t("deals.title")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="slds-card p-6">
              <h3 className="text-lg font-semibold mb-4">{t("common.tags")}</h3>
              <TagsInput entityType="company" entityId={id} />
            </div>

            {/* Notes */}
            {company.notes && (
              <div className="slds-card p-6">
                <h3 className="text-lg font-semibold mb-4">{t("common.notes")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="slds-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("contacts.title")}</h3>
            </div>
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("companies.noContacts")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th>{t("contacts.name")}</th>
                      <th>{t("contacts.email")}</th>
                      <th>{t("contacts.phone")}</th>
                      <th>{t("contacts.position")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>
                          <a href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                            {contact.first_name} {contact.last_name}
                          </a>
                        </td>
                        <td>{contact.email || "-"}</td>
                        <td>{contact.phone || "-"}</td>
                        <td>{contact.position || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "deals" && (
          <div className="slds-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">{t("deals.title")}</h3>
            </div>
            {deals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("companies.noDeals")}
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
                            {t(`stages.${deal.stage}`) || deal.stage}
                          </span>
                        </td>
                        <td>{deal.expected_close_date ? formatDate(deal.expected_close_date) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CompanyForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleUpdate}
        initialData={company}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("companies.deleteCompany")}
        message={t("companies.deleteCompanyMessage", { name: company.name })}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
