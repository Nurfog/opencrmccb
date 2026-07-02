import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="slds-empty">
      <div className="slds-empty__icon">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="slds-empty__title">{title}</h3>
      {description && <p className="slds-empty__description">{description}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="slds-btn slds-btn--brand">
          {action.label}
        </button>
      )}
    </div>
  )
}
