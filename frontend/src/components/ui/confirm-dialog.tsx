"use client"

import { Modal } from "./modal"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"

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
  const { t } = useI18n()
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-3.5">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-[12px] border flex items-center justify-center ${
            variant === "danger"
              ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
              : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
          }`}
        >
          {variant === "danger" ? (
            <Trash2 className="h-[18px] w-[18px]" />
          ) : (
            <AlertTriangle className="h-[18px] w-[18px]" />
          )}
        </div>
        <div className="flex-1 pt-1">
          <p className="text-[13.5px] text-muted-foreground leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="slds-modal__footer">
        <button type="button" onClick={onClose} className="slds-btn slds-btn--neutral">
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            variant === "danger"
              ? "slds-btn slds-btn--destructive"
              : "slds-btn text-white hover:brightness-95 bg-[hsl(var(--warning))]"
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
