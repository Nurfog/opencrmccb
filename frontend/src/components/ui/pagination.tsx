"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, perPage, onPageChange }: PaginationProps) {
  const { t } = useI18n()
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const getVisiblePages = () => {
    const pages: number[] = []
    const start = Math.max(1, page - 1)
    const end = Math.min(totalPages, page + 1)

    if (start > 1) pages.push(1)
    if (start > 2) pages.push(-1)

    for (let i = start; i <= end; i++) pages.push(i)

    if (end < totalPages - 1) pages.push(-1)
    if (end < totalPages) pages.push(totalPages)

    return pages
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {total === 0
          ? t("pagination.noResults")
          : t("pagination.showing", { from: String(from), to: String(to), total: String(total) })}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="slds-btn slds-btn--neutral px-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getVisiblePages().map((p, i) =>
          p === -1 ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "slds-btn min-w-[2rem] px-2",
                p === page
                  ? "slds-btn--brand"
                  : "slds-btn--neutral"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="slds-btn slds-btn--neutral px-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
