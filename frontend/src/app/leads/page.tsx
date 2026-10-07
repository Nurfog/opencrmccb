"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, ChevronUp, ChevronDown, Edit, Trash2, ArrowRightLeft, Filter, X, Target } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { leadsApi, type Lead, type PaginatedResponse, type LeadStats } from "@/lib/api"
import { LeadForm } from "@/components/forms/lead-form"
import { ConvertLeadDialog } from "@/components/forms/convert-lead-dialog"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDate, cn } from "@/lib/utils"
import Link from "next/link"

type SortField = "first_name" | "company_name" | "score" | "lead_source" | "created_at"
type SortDir = "asc" | "desc"

const STATUS_COLORS: Record<string, string> = {
  new: "slds-tag slds-tag--info",
  contacted: "slds-tag slds-tag--warning",
  qualified: "slds-tag slds-tag--success",
  unqualified: "slds-tag slds-tag--muted",
  converted: "slds-tag slds-tag--violet",
  recycled: "slds-tag slds-tag--warning",
}

const SOURCE_LABELS: Record<string, string> = {
  web: "Web",
  referral: "Referral",
  cold_call: "Cold Call",
  advertisement: "Ad",
  email: "Email",
  social: "Social",
  partner: "Partner",
  event: "Event",
  other: "Other",
}

export default function LeadsPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [data, setData] = useState<PaginatedResponse<Lead> | null>(null)
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const perPage = 25

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const params: Record<string, unknown> = {
        page,
        per_page: perPage,
        sort: sortField,
        sort_dir: sortDir,
      }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (sourceFilter) params.lead_source = sourceFilter

      const res = await leadsApi.list(params as Parameters<typeof leadsApi.list>[0])
      setData(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading leads"
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [page, search, sortField, sortDir, statusFilter, sourceFilter])

  const fetchStats = useCallback(async () => {
    try {
      const res = await leadsApi.stats()
      setStats(res)
    } catch {}
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === "asc" ? (
      <ChevronUp className="inline w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-1" />
    )
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await leadsApi.delete(deleteTarget.id)
      success(t("common.delete") || "Deleted")
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchLeads()
      fetchStats()
    } catch {
      error(t("common.error") || "Error")
    }
  }

  const handleFormSuccess = () => {
    setFormOpen(false)
    setEditingLead(null)
    fetchLeads()
    fetchStats()
  }

  const handleConvertSuccess = () => {
    setConvertOpen(false)
    setConvertTarget(null)
    fetchLeads()
    fetchStats()
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400"
    if (score >= 20) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="slds-card p-4">
              <div className="text-sm text-muted-foreground">{t("leads.stats.total")}</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="slds-card p-4">
              <div className="text-sm text-muted-foreground">{t("leads.stats.new")}</div>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </div>
            <div className="slds-card p-4">
              <div className="text-sm text-muted-foreground">{t("leads.stats.contacted")}</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
            </div>
            <div className="slds-card p-4">
              <div className="text-sm text-muted-foreground">{t("leads.stats.qualified")}</div>
              <div className="text-2xl font-bold text-green-600">{stats.qualified}</div>
            </div>
            <div className="slds-card p-4">
              <div className="text-sm text-muted-foreground">{t("leads.stats.conversion")}</div>
              <div className="text-2xl font-bold text-primary">{stats.conversion_rate.toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("leads.title")}</h1>
            <p className="slds-header__description">
              {t("leads.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditingLead(null); setFormOpen(true) }}
            className="slds-btn slds-btn--brand flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("leads.newLead")}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("leads.searchLeads")}
                className="slds-input pl-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                "slds-btn slds-btn--neutral",
                (filterOpen || statusFilter || sourceFilter) && "border-primary bg-primary/5 text-primary"
              )}
            >
              <Filter className="w-4 h-4" />
              {t("common.filters")}
            </button>
          </form>
        </div>

        {/* Filter Panel */}
        {filterOpen && (
          <div className="slds-card p-4 flex gap-4 flex-wrap">
            <div>
              <label className="slds-label">{t("leads.status")}</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="slds-input w-auto"
              >
                <option value="">{t("common.all")}</option>
                <option value="new">{t("leads.statuses.new")}</option>
                <option value="contacted">{t("leads.statuses.contacted")}</option>
                <option value="qualified">{t("leads.statuses.qualified")}</option>
                <option value="unqualified">{t("leads.statuses.unqualified")}</option>
                <option value="converted">{t("leads.statuses.converted")}</option>
                <option value="recycled">{t("leads.statuses.recycled")}</option>
              </select>
            </div>
            <div>
              <label className="slds-label">{t("leads.source")}</label>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
                className="slds-input w-auto"
              >
                <option value="">{t("common.all")}</option>
                {Object.entries(SOURCE_LABELS).map(([key]) => (
                  <option key={key} value={key}>{t(`leads.sources.${key}`)}</option>
                ))}
              </select>
            </div>
            {(statusFilter || sourceFilter) && (
              <button
                type="button"
                onClick={() => { setStatusFilter(""); setSourceFilter(""); setPage(1) }}
                className="flex items-center gap-1 text-sm text-primary hover:opacity-80 self-end"
              >
                <X className="w-4 h-4" />
                {t("common.clearFilters")}
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="slds-card overflow-hidden">
          {loading ? (
            <TableSkeleton rows={10} />
          ) : errorState ? (
            <div className="p-8 text-center text-red-600">{errorState}</div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              icon={Target}
              title={t("leads.noLeads")}
              description={t("leads.noLeadsDescription")}
              action={{
                label: t("leads.newLead"),
                onClick: () => { setEditingLead(null); setFormOpen(true) },
              }}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleSort("first_name")}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {t("leads.name")} <SortIcon field="first_name" />
                      </th>
                      <th>
                        {t("leads.company")}
                      </th>
                      <th>
                        {t("leads.status")}
                      </th>
                      <th
                        onClick={() => handleSort("score")}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {t("leads.score")} <SortIcon field="score" />
                      </th>
                      <th
                        onClick={() => handleSort("lead_source")}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {t("leads.source")} <SortIcon field="lead_source" />
                      </th>
                      <th
                        onClick={() => handleSort("created_at")}
                        className="cursor-pointer hover:text-foreground"
                      >
                        {t("leads.created")} <SortIcon field="created_at" />
                      </th>
                      <th className="text-right">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-primary hover:underline">
                            {lead.first_name} {lead.last_name}
                          </Link>
                          {lead.email && (
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          )}
                        </td>
                        <td className="text-sm text-foreground">
                          {lead.company_name || "—"}
                        </td>
                        <td>
                          <span className={cn(STATUS_COLORS[lead.status] || STATUS_COLORS.new)}>
                            {lead.status}
                          </span>
                        </td>
                        <td>
                          <span className={cn("text-sm font-medium", getScoreColor(lead.score))}>
                            {lead.score}
                          </span>
                        </td>
                        <td className="text-sm text-foreground">
                          {t(`leads.sources.${lead.lead_source}`) || lead.lead_source}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {lead.status !== "converted" && (
                              <button
                                type="button"
                                onClick={() => { setConvertTarget(lead); setConvertOpen(true) }}
                                className="slds-btn slds-btn--icon text-primary"
                                title={t("leads.convert")}
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setEditingLead(lead); setFormOpen(true) }}
                              className="slds-btn slds-btn--icon"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteTarget(lead); setDeleteOpen(true) }}
                              className="slds-btn slds-btn--icon text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border">
                <Pagination
                  page={data.page}
                  totalPages={data.total_pages}
                  total={data.total}
                  perPage={perPage}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lead Form Modal */}
      <LeadForm
        open={formOpen}
        lead={editingLead}
        onClose={() => { setFormOpen(false); setEditingLead(null) }}
        onSuccess={handleFormSuccess}
      />

      {/* Convert Lead Dialog */}
      <ConvertLeadDialog
        open={convertOpen}
        lead={convertTarget}
        onClose={() => { setConvertOpen(false); setConvertTarget(null) }}
        onSuccess={handleConvertSuccess}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={t("leads.deleteLead")}
        message={t("leads.deleteLeadMessage", { name: `${deleteTarget?.first_name} ${deleteTarget?.last_name}` })}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </AppLayout>
  )
}
