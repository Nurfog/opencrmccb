"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, LayoutGrid, List, X, CircleDollarSign } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { dealsApi, auditApi, type Deal } from "@/lib/api"
import { DealForm } from "@/components/forms/deal-form"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { DealsTableView } from "@/components/deals/deals-table-view"
import { DealsKanbanView, DealsKanbanSkeleton } from "@/components/deals/deals-kanban-view"
import { DealDetailModal } from "@/components/deals/deal-detail-modal"
import { STAGE_CONFIG, stageI18nKey, type AuditEvent } from "@/components/deals/deals-constants"

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
            <DealsKanbanSkeleton />
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
          <DealsKanbanView
            deals={deals}
            onStageChange={handleStageChange}
            onView={openView}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        ) : (
          <DealsTableView
            deals={deals}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            perPage={perPage}
            onPageChange={setPage}
            onView={openView}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        )}
      </div>

      <DealForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingDeal(null) }}
        onSubmit={handleFormSubmit}
        initialData={editingDeal ?? undefined}
      />

      <DealDetailModal
        deal={viewDeal}
        isOpen={viewDealOpen}
        onClose={() => setViewDealOpen(false)}
        viewTab={viewTab}
        onViewTabChange={setViewTab}
        dealHistory={dealHistory}
        historyLoading={historyLoading}
      />

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
