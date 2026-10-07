"use client"

import { List } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { useI18n } from "@/contexts/i18n-context"
import { type Deal } from "@/lib/api"
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils"
import { stageColors, stageI18nKey, type AuditEvent } from "./deals-constants"

interface DealDetailModalProps {
  deal: Deal | null
  isOpen: boolean
  onClose: () => void
  viewTab: "details" | "history"
  onViewTabChange: (tab: "details" | "history") => void
  dealHistory: AuditEvent[]
  historyLoading: boolean
}

export function DealDetailModal({
  deal,
  isOpen,
  onClose,
  viewTab,
  onViewTabChange,
  dealHistory,
  historyLoading,
}: DealDetailModalProps) {
  const { t } = useI18n()

  const stageLabel = (stage: string): string => {
    const key = stageI18nKey[stage.toLowerCase()]
    return key ? t(key) : stage
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("deals.dealDetails")} size="lg">
      {deal && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight">{deal.title}</h3>
              <p className="text-[22px] font-semibold tracking-tight mt-1">{formatCurrency(deal.value, deal.currency)}</p>
            </div>
            <span className={cn("slds-badge", stageColors[deal.stage] ?? "")}>
              {stageLabel(deal.stage)}
            </span>
          </div>

          <div className="flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => onViewTabChange("details")}
              className={cn(
                "px-3.5 py-2 text-[13.5px] font-medium border-b-2 -mb-px transition-colors",
                viewTab === "details"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t("deals.dealDetails")}
            </button>
            <button
              type="button"
              onClick={() => onViewTabChange("history")}
              className={cn(
                "px-3.5 py-2 text-[13.5px] font-medium border-b-2 -mb-px transition-colors",
                viewTab === "history"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t("audit.title")}
            </button>
          </div>

          {viewTab === "details" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="slds-label">{t("deals.dealName")}</label>
              <p className="text-[13.5px]">{deal.title}</p>
            </div>
            <div>
              <label className="slds-label">{t("deals.amount")}</label>
              <p className="text-[13.5px]">{formatCurrency(deal.value, deal.currency)}</p>
            </div>
            <div>
              <label className="slds-label">{t("deals.stage")}</label>
              <p className="text-[13.5px]">{stageLabel(deal.stage)}</p>
            </div>
            {deal.expected_close_date && (
              <div>
                <label className="slds-label">{t("deals.expectedCloseDate")}</label>
                <p className="text-[13.5px]">{formatDate(deal.expected_close_date)}</p>
              </div>
            )}
            {deal.created_at && (
              <div>
                <label className="slds-label">{t("audit.date")}</label>
                <p className="text-[13.5px]">{formatDate(deal.created_at)}</p>
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
                  <div key={event.id} className="flex gap-3 py-3 border-b border-border/70 last:border-b-0">
                    <div className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium">{event.action}</p>
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
  )
}
