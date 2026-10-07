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
  // TODO: picks up heterogeneous deal shapes; keep `any` until Deal union is stable.
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
    if (!dealId) return
    const targetStageId = String(over.id)
    // Skip spurious updates: dropping back on the origin column must not
    // fire PATCH. Deals may carry the stage id or the stage name.
    const deal = deals.find((d) => String(d.id) === dealId)
    const targetStage = stages.find((s) => s.id === targetStageId)
    if (
      deal &&
      (deal.stage === targetStageId ||
        (targetStage && deal.stage === targetStage.name))
    ) {
      return
    }
    onStageChange(dealId, targetStageId)
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
