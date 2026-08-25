"use client"

import { type Deal } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { KanbanBoard } from "@/components/kanban/kanban-board"
import { STAGE_CONFIG, stageColors } from "./deals-constants"

interface DealsKanbanViewProps {
  deals: Deal[]
  onStageChange: (dealId: string, newStage: string) => void
  onView: (deal: Deal) => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function DealsKanbanView({
  deals,
  onStageChange,
  onView,
  onEdit,
  onDelete,
}: DealsKanbanViewProps) {
  return (
    <KanbanBoard
      stages={STAGE_CONFIG.map((s) => ({ id: s.id, name: s.name, color: stageColors[s.id] }))}
      deals={deals}
      onStageChange={onStageChange}
      formatCurrency={(value: number, currency: string) => formatCurrency(value, currency)}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}

export function DealsKanbanSkeleton() {
  return (
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
  )
}
