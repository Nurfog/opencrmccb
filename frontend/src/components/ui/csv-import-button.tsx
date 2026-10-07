"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"

interface CsvImportButtonProps {
  onImport: (csv: string) => Promise<{ imported: number; errors: string[] }>
  onDone: () => void
}

const MAX_BYTES = 2 * 1024 * 1024

export function CsvImportButton({ onImport, onDone }: CsvImportButtonProps) {
  const { t } = useI18n()
  const { success, error } = useToast()
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return
    if (file.size > MAX_BYTES) {
      error(t("common.fileTooLarge"))
      return
    }
    setBusy(true)
    try {
      const text = await file.text()
      if (!text.trim()) {
        error(t("common.invalidFile"))
        return
      }
      const res = await onImport(text)
      if (res.errors.length > 0) {
        error(
          t("common.importPartial", {
            imported: String(res.imported),
            failed: String(res.errors.length),
          }) + `: ${res.errors.slice(0, 3).join("; ")}`
        )
      } else {
        success(t("common.imported", { count: String(res.imported) }))
      }
      onDone()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t("common.error"))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="slds-btn slds-btn--neutral flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        {t("common.import")}
      </button>
    </>
  )
}
