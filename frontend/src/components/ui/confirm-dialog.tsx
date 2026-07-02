"use client"

import { Modal } from "./modal"
import { AlertTriangle, Trash2 } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: "danger" | "warning"
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  variant = "danger",
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            variant === "danger"
              ? "bg-red-100 dark:bg-red-900/30 text-red-600"
              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
          }`}
        >
          {variant === "danger" ? (
            <Trash2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <div className="slds-modal__footer">
        <button type="button" onClick={onClose} className="slds-btn slds-btn--neutral">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            variant === "danger"
              ? "slds-btn slds-btn--destructive"
              : "slds-btn bg-yellow-500 text-white hover:bg-yellow-600"
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
