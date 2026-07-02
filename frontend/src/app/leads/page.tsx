"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, ChevronUp, ChevronDown, Edit, Trash2, ArrowRightLeft, Filter, X, Target, BarChart3 } from "lucide-react"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">{t("leads.stats.total")}</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">{t("leads.stats.new")}</div>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">{t("leads.stats.contacted")}</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">{t("leads.stats.qualified")}</div>
              <div className="text-2xl font-bold text-green-600">{stats.qualified}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">{t("leads.stats.conversion")}</div>
              <div className="text-2xl font-bold text-purple-600">{stats.conversion_rate.toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("leads.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("leads.description")}
            </p>
          </div>
          <button
            onClick={() => { setEditingLead(null); setFormOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("leads.newLead")}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("leads.searchLeads")}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors",
                filterOpen || statusFilter || sourceFilter
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              <Filter className="w-4 h-4" />
              {t("common.filters")}
            </button>
          </form>
        </div>

        {/* Filter Panel */}
        {filterOpen && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("leads.status")}</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("leads.source")}</label>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t("common.all")}</option>
                {Object.entries(SOURCE_LABELS).map(([key]) => (
                  <option key={key} value={key}>{t(`leads.sources.${key}`)}</option>
                ))}
              </select>
            </div>
            {(statusFilter || sourceFilter) && (
              <button
                onClick={() => { setStatusFilter(""); setSourceFilter(""); setPage(1) }}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 self-end"
              >
                <X className="w-4 h-4" />
                {t("common.clearFilters")}
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th
                        onClick={() => handleSort("first_name")}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {t("leads.name")} <SortIcon field="first_name" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("leads.company")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("leads.status")}
                      </th>
                      <th
                        onClick={() => handleSort("score")}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {t("leads.score")} <SortIcon field="score" />
                      </th>
                      <th
                        onClick={() => handleSort("lead_source")}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {t("leads.source")} <SortIcon field="lead_source" />
                      </th>
                      <th
                        onClick={() => handleSort("created_at")}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {t("leads.created")} <SortIcon field="created_at" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.data.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                            {lead.first_name} {lead.last_name}
                          </Link>
                          {lead.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{lead.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {lead.company_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex px-2 py-1 text-xs font-semibold rounded-full", STATUS_COLORS[lead.status] || STATUS_COLORS.new)}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-sm font-medium", getScoreColor(lead.score))}>
                            {lead.score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {t(`leads.sources.${lead.lead_source}`) || lead.lead_source}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {lead.status !== "converted" && (
                              <button
                                onClick={() => { setConvertTarget(lead); setConvertOpen(true) }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                title={t("leads.convert")}
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingLead(lead); setFormOpen(true) }}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(lead); setDeleteOpen(true) }}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
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
