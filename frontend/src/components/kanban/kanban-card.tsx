import { useDraggable } from "@dnd-kit/core"
import { Edit, Trash2, Eye } from "lucide-react"

interface KanbanCardProps {
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
      className="slds-kanban__card"
    >
      <div className="space-y-3">
        <div className="font-medium text-sm leading-tight">{deal.title || deal.name}</div>
        <div className="text-base font-semibold text-salesforce-blue dark:text-blue-400">
          {formatCurrency(deal.value ?? 0, deal.currency ?? "USD")}
        </div>
        {deal.company_name && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {deal.company_name}
          </div>
        )}
        <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-2 dark:border-gray-700">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onView(deal)
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(deal)
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(deal)
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
