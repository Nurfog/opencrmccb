import { useDroppable } from "@dnd-kit/core"
import { KanbanCard } from "./kanban-card"

interface Stage {
  id: string
  name: string
  color: string
}

interface KanbanColumnProps {
  stage: Stage
  deals: any[]
  formatCurrency: (value: number, currency: string) => string
  onView: (deal: any) => void
  onEdit: (deal: any) => void
  onDelete: (deal: any) => void
}

export function KanbanColumn({
  stage,
  deals,
  formatCurrency,
  onView,
  onEdit,
  onDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className={`slds-kanban__column ${isOver ? "slds-kanban__column--over" : ""}`}
    >
      <div className="slds-kanban__column-header">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-semibold text-sm">{stage.name}</span>
          <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {deals.length}
          </span>
        </div>
      </div>
      <div className="slds-kanban__column-body">
        {deals.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400">
            No deals
          </div>
        )}
        {deals.map((deal) => (
          <KanbanCard
            key={deal.id}
            deal={deal}
            formatCurrency={formatCurrency}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
