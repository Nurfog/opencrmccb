"use client"

import { Eye, Edit, Trash2 } from "lucide-react"
import { type Deal } from "@/lib/api"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination"
import { useI18n } from "@/contexts/i18n-context"
import Link from "next/link"
import { stageColors, stageI18nKey } from "./deals-constants"

interface DealsTableViewProps {
  deals: Deal[]
  page: number
  totalPages: number
  totalCount: number
  perPage: number
  onPageChange: (page: number) => void
  onView: (deal: Deal) => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function DealsTableView({
  deals,
  page,
  totalPages,
  totalCount,
  perPage,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: DealsTableViewProps) {
  const { t } = useI18n()

  const stageLabel = (stage: string): string => {
    const key = stageI18nKey[stage.toLowerCase()]
    return key ? t(key) : stage
  }

  return (
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
                  <td className="font-medium"><Link href={`/deals/${deal.id}`} className="hover:underline">{deal.title}</Link></td>
                  <td>{formatCurrency(deal.value, deal.currency)}</td>
                  <td>
                    <span className={cn("slds-badge", stageColors[deal.stage] ?? "")}>
                      {stageLabel(deal.stage)}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{deal.expected_close_date ? formatDate(deal.expected_close_date) : "-"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => onView(deal)} className="slds-btn slds-btn--icon">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => onEdit(deal)} className="slds-btn slds-btn--icon">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => onDelete(deal)} className="slds-btn slds-btn--icon text-red-500 hover:text-red-700 dark:hover:text-red-400">
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
        onPageChange={onPageChange}
      />
    </>
  )
}
