"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, LayoutGrid, List, X, Eye, Edit, Trash2, CircleDollarSign } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { dealsApi, auditApi, type Deal } from "@/lib/api"
import { KanbanBoard } from "@/components/kanban/kanban-board"
import { DealForm } from "@/components/forms/deal-form"
import { Modal } from "@/components/ui/modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils"

interface AuditEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
}

const STAGE_CONFIG = [
  { id: "lead", name: "Lead", color: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600" },
  { id: "qualified", name: "Qualified", color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600" },
  { id: "proposal", name: "Proposal", color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600" },
  { id: "negotiation", name: "Negotiation", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600" },
  { id: "closed_won", name: "Closed Won", color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600" },
  { id: "closed_lost", name: "Closed Lost", color: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-600" },
]

const stageColors: Record<string, string> = {
  lead: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  qualified: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  proposal: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  negotiation: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  closed_won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  closed_lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
}

const stageI18nKey: Record<string, string> = {
  lead: "stages.lead",
  qualified: "stages.qualified",
  proposal: "stages.proposal",
  negotiation: "stages.negotiation",
  closed_won: "stages.closedWon",
  closed_lost: "stages.closedLost",
}

export default function DealsPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const stageLabel = (stage: string): string => {
    const key = stageI18nKey[stage.toLowerCase()]
    return key ? t(key) : stage
  }

  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [viewMode, setViewMode] = useState<"pipeline" | "history">("pipeline")
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const [viewDeal, setViewDeal] = useState<Deal | null>(null)
  const [viewDealOpen, setViewDealOpen] = useState(false)
  const [viewTab, setViewTab] = useState<"details" | "history">("details")
  const [dealHistory, setDealHistory] = useState<AuditEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const perPage = 50

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await dealsApi.list({
        page,
        per_page: perPage,
        search: search || undefined,
        stage: activeStage ?? undefined,
      })
      setDeals(res.data)
      setTotalCount(res.total)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [page, search, activeStage, t])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

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

  const stageCounts = STAGE_CONFIG.map((stage) => ({
    ...stage,
    count: deals.filter((d) => d.stage === stage.id).length,
  }))

  const totalPages = Math.ceil(totalCount / perPage)

  const handleStageFilter = (stageId: string | null) => {
    setActiveStage((prev) => (prev === stageId ? null : stageId))
    setPage(1)
  }

  const openCreate = () => {
    setEditingDeal(null)
    setFormOpen(true)
  }

  const openEdit = (deal: Deal) => {
    setEditingDeal(deal)
    setFormOpen(true)
  }

  const openView = (deal: Deal) => {
    setViewDeal(deal)
    setViewDealOpen(true)
    setViewTab("details")
    setDealHistory([])
    fetchDealHistory(deal.id)
  }

  const openDelete = (deal: Deal) => {
    setDeleteTarget(deal)
    setDeleteOpen(true)
  }

  const fetchDealHistory = async (dealId: string) => {
    setHistoryLoading(true)
    try {
      const res = await auditApi.entityHistory("deal", dealId)
      setDealHistory(res as unknown as AuditEvent[])
    } catch {
      setDealHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    try {
      if (editingDeal) {
        const { stage, ...rest } = formData
        await dealsApi.update(editingDeal.id, {
          ...rest,
          stage: stage as string || undefined,
        } as Partial<Deal>)
        success(t("toast.updated", { entity: t("deals.dealName") }))
      } else {
        const { stage, ...rest } = formData
        await dealsApi.create({
          ...rest,
          stage: stage as string,
        } as Parameters<typeof dealsApi.create>[0])
        success(t("toast.created", { entity: t("deals.dealName") }))
      }
      setFormOpen(false)
      setEditingDeal(null)
      fetchDeals()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: editingDeal ? "update" : "create", entity: t("deals.dealName") })
      error(msg)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await dealsApi.delete(deleteTarget.id)
      success(t("toast.deleted", { entity: t("deals.dealName") }))
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchDeals()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("deals.dealName") })
      error(msg)
    }
  }

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      await dealsApi.updateStage(dealId, { stage: newStage })
      fetchDeals()
    } catch {
      error(t("toast.error", { action: "update", entity: t("deals.dealName") }))
    }
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("deals.title")}</h1>
            <p className="slds-header__description">{t("deals.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("pipeline")}
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "pipeline"
                    ? "bg-brand text-white"
                    : "bg-white dark:bg-gray-800 text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Pipeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode("history")}
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "history"
                    ? "bg-brand text-white"
                    : "bg-white dark:bg-gray-800 text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <List className="h-4 w-4" />
                {t("common.list")}
              </button>
            </div>
            <button type="button" onClick={openCreate} className="slds-btn slds-btn--brand flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("deals.newDeal")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="slds-input pl-10 pr-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("common.search")}
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {stageCounts.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStageFilter(stage.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                stage.color,
                activeStage === stage.id && "ring-2 ring-brand ring-offset-2 dark:ring-offset-gray-900"
              )}
            >
              <span className="font-medium">{stageLabel(stage.id)}</span>
              <span className="text-xs font-semibold">{stage.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          viewMode === "pipeline" ? (
            <div className="slds-kanban">
              {STAGE_CONFIG.map((stage) => (
                <div key={stage.id} className="slds-kanban__column space-y-2">
                  <div className="slds-kanban__column-header">
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                  <div className="slds-kanban__column-body min-h-[200px]">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="slds-kanban__card space-y-2">
                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                        <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                        <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableSkeleton rows={8} />
          )
        ) : errorState ? (
          <EmptyState
            icon={CircleDollarSign}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchDeals }}
          />
        ) : deals.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title={t("deals.noDeals")}
            action={{ label: t("deals.newDeal"), onClick: openCreate }}
          />
        ) : viewMode === "pipeline" ? (
          <KanbanBoard
            stages={STAGE_CONFIG.map((s) => ({ id: s.id, name: s.name, color: stageColors[s.id] }))}
            deals={deals}
            onStageChange={handleStageChange}
            formatCurrency={(value: number, currency: string) => formatCurrency(value, currency)}
            onView={openView}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        ) : (
          <>
            <div className="slds-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th>{t("deals.dealName")}</th>
                      <th>{t("deals.amount")}</th>
                      <th>{t("deals.stage")}</th>
                      <th>{t("deals.expectedCloseDate")}</th>
                      <th>{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <tr key={deal.id}>
                        <td className="font-medium"><a href={`/deals/${deal.id}`} className="hover:underline">{deal.title}</a></td>
                        <td>{formatCurrency(deal.value, deal.currency)}</td>
                        <td>
                          <span className={cn("slds-badge", stageColors[deal.stage] ?? "")}>
                            {stageLabel(deal.stage)}
                          </span>
                        </td>
                        <td className="text-muted-foreground">{deal.expected_close_date ? formatDate(deal.expected_close_date) : "-"}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openView(deal)} className="slds-btn slds-btn--icon">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(deal)} className="slds-btn slds-btn--icon">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openDelete(deal)} className="slds-btn slds-btn--icon text-red-500 hover:text-red-700 dark:hover:text-red-400">
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
            <Pagination
              page={page}
              totalPages={totalPages}
              total={totalCount}
              perPage={perPage}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <DealForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingDeal(null) }}
        onSubmit={handleFormSubmit}
        initialData={editingDeal ?? undefined}
      />

      <Modal isOpen={viewDealOpen} onClose={() => setViewDealOpen(false)} title={t("deals.dealDetails")} size="lg">
        {viewDeal && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{viewDeal.title}</h3>
                <p className="text-2xl font-bold mt-1">{formatCurrency(viewDeal.value, viewDeal.currency)}</p>
              </div>
              <span className={cn("slds-badge", stageColors[viewDeal.stage] ?? "")}>
                {stageLabel(viewDeal.stage)}
              </span>
            </div>

            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setViewTab("details")}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  viewTab === "details"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t("deals.dealDetails")}
              </button>
              <button
                type="button"
                onClick={() => setViewTab("history")}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  viewTab === "history"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t("audit.title")}
              </button>
            </div>

            {viewTab === "details" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="slds-label">{t("deals.dealName")}</label>
                  <p className="text-sm">{viewDeal.title}</p>
                </div>
                <div>
                  <label className="slds-label">{t("deals.amount")}</label>
                  <p className="text-sm">{formatCurrency(viewDeal.value, viewDeal.currency)}</p>
                </div>
                <div>
                  <label className="slds-label">{t("deals.stage")}</label>
                  <p className="text-sm">{stageLabel(viewDeal.stage)}</p>
                </div>
                {viewDeal.expected_close_date && (
                  <div>
                    <label className="slds-label">{t("deals.expectedCloseDate")}</label>
                    <p className="text-sm">{formatDate(viewDeal.expected_close_date)}</p>
                  </div>
                )}
                {viewDeal.created_at && (
                  <div>
                    <label className="slds-label">{t("audit.date")}</label>
                    <p className="text-sm">{formatDate(viewDeal.created_at)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-0">
                {historyLoading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{t("app.loading")}</div>
                ) : dealHistory.length === 0 ? (
                  <EmptyState icon={List} title={t("audit.noEvents")} />
                ) : (
                  dealHistory.map((event) => (
                    <div key={event.id} className="flex gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.action}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={t("deals.deleteDeal")}
        message={deleteTarget ? t("deals.deleteDealMessage", { title: deleteTarget.title }) : ""}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
