"use client"

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { KanbanColumn } from "./kanban-column"
import type { Deal } from "@/lib/api"

interface Stage {
  id: string
  name: string
  color: string
}

interface KanbanBoardProps {
  stages: Stage[]
  deals: Deal[]
  onStageChange: (dealId: string, newStage: string, position?: number) => void
  formatCurrency: (value: number, currency: string) => string
  onView: (deal: Deal) => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function KanbanBoard({
  stages,
  deals,
  onStageChange,
  formatCurrency,
  onView,
  onEdit,
  onDelete,
}: KanbanBoardProps) {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const sensors = useSensors(pointerSensor)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const dealId = String(active.id).replace("deal-", "")
    if (dealId && over.id !== active.id) {
      onStageChange(dealId, String(over.id))
    }
  }

  // Backend stages are snake_case ids ("closed_won"); normalize both sides
  // so legacy display names ("Closed Won") still land in the right column
  // instead of vanishing (or matching two columns at once).
  const normalizeStage = (s: string) => s.toLowerCase().replace(/\s+/g, "_")

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="slds-kanban">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => normalizeStage(d.stage) === stage.id)}
            formatCurrency={formatCurrency}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  )
}
