"use client"

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { KanbanColumn } from "./kanban-column"

interface Stage {
  id: string
  name: string
  color: string
}

interface KanbanBoardProps {
  stages: Stage[]
  deals: any[]
  onStageChange: (dealId: string, newStage: string, position?: number) => void
  formatCurrency: (value: number, currency: string) => string
  onView: (deal: any) => void
  onEdit: (deal: any) => void
  onDelete: (deal: any) => void
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="slds-kanban">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stage === stage.name || d.stage === stage.id)}
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
