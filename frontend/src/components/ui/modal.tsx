"use client"

import { useEffect, useRef, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return []
    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  }, [])

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      requestAnimationFrame(() => {
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
          focusable[0].focus()
        }
      })
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, getFocusableElements])

  useEffect(() => {
    if (!isOpen) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }

      if (e.key === "Tab") {
        const focusable = getFocusableElements()
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose, getFocusableElements])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="slds-modal-backdrop"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        ref={modalRef}
        className={cn("slds-modal-content", sizeClasses[size])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="slds-modal__header">
          <h2 className="slds-modal__title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="slds-modal__body">{children}</div>
      </div>
    </div>
  )
}
