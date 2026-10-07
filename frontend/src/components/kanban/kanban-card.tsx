import { useDraggable } from "@dnd-kit/core"
import { Edit, Trash2, Eye } from "lucide-react"

interface KanbanCardProps {
  // TODO: replace `Deal | Record<string, unknown>` anys with strict Deal type
  // once the board supports heterogeneous deal shapes without breaking build.
  deal: any
  formatCurrency: (value: number, currency: string) => string
  onView: (deal: any) => void
  onEdit: (deal: any) => void
  onDelete: (deal: any) => void
}

export function KanbanCard({
  deal,
  formatCurrency,
  onView,
  onEdit,
  onDelete,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `deal-${deal.id}`,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : undefined,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`slds-kanban__card ${isDragging ? "slds-kanban__card--dragging" : ""}`}
    >
      <div className="space-y-2.5">
        <div className="font-medium text-[13.5px] leading-snug tracking-tight">{deal.title || deal.name}</div>
        <div className="text-[15px] font-semibold tracking-tight text-primary">
          {formatCurrency(deal.value ?? 0, deal.currency ?? "USD")}
        </div>
        {deal.company_name && (
          <div className="text-xs text-muted-foreground truncate">
            {deal.company_name}
          </div>
        )}
        <div className="flex items-center justify-end gap-0.5 border-t border-border/70 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onView(deal)
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="View"
            aria-label="View deal"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(deal)
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Edit"
            aria-label="Edit deal"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(deal)
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors"
            title="Delete"
            aria-label="Delete deal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
