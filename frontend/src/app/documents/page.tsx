"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, FileText, Folder, Upload, Download, Trash2, Search, X, File, Image, FileSpreadsheet, FileArchive } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { documentsApi, type Document } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDate, formatNumber, cn } from "@/lib/utils"

const FOLDERS = ["All", "Contracts", "Reports", "Invoices", "Proposals", "Other"]

const mimeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  image: Image,
  spreadsheet: FileSpreadsheet,
  zip: FileArchive,
  text: File,
}

function getMimeCategory(mime: string): string {
  if (mime.includes("pdf")) return "pdf"
  if (mime.includes("image")) return "image"
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "spreadsheet"
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return "zip"
  if (mime.includes("text")) return "text"
  return "pdf"
}

const mimeColors: Record<string, string> = {
  pdf: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  image: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  spreadsheet: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  zip: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
  text: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState("All")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFolder, setUploadFolder] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await documentsApi.list({
        folder: activeFolder === "All" ? undefined : activeFolder.toLowerCase(),
        search: search || undefined,
      })
      setDocs(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [activeFolder, search, t])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput("")
    setSearch("")
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setUploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDownload = async (doc: Document) => {
    const blob = await documentsApi.download(doc.id)
    if (!blob) {
      error(t("toast.error", { action: "download", entity: t("documents.title") }))
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = doc.original_name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      if (uploadFolder) formData.append("folder", uploadFolder)
      await documentsApi.upload(formData)
      success(t("toast.created", { entity: t("documents.title") }))
      setUploadOpen(false)
      setUploadFile(null)
      setUploadFolder("")
      fetchDocuments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "upload", entity: t("documents.title") })
      error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await documentsApi.delete(deleteTarget.id)
      success(t("toast.deleted", { entity: t("documents.title") }))
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchDocuments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("documents.title") })
      error(msg)
    }
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("documents.title")}</h1>
            <p className="slds-header__description">{t("documents.description")}</p>
          </div>
          <button type="button" onClick={() => setUploadOpen(true)} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t("documents.uploadFile")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="slds-input pl-10 pr-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("common.search")}
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {FOLDERS.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setActiveFolder(folder)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                activeFolder === folder
                  ? "bg-brand text-white border-brand"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <Folder className="h-4 w-4" />
              {folder === "All" ? t("common.all") : folder}
            </button>
          ))}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : errorState ? (
          <EmptyState
            icon={FileText}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchDocuments }}
          />
        ) : !docs || docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("documents.noDocuments")}
            description={t("documents.noDocumentsDescription")}
            action={{ label: t("documents.uploadFile"), onClick: () => setUploadOpen(true) }}
          />
        ) : (
          <div className="slds-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="slds-table">
                <thead>
                  <tr>
                    <th>{t("documents.fileName")}</th>
                    <th>{t("documents.folder")}</th>
                    <th>{t("documents.size")}</th>
                    <th className="w-24">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => {
                    const cat = getMimeCategory(doc.mime_type ?? "")
                    const Icon = mimeIcons[cat] ?? FileText
                    return (
                      <tr key={doc.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${mimeColors[cat] ?? mimeColors.pdf}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium">{doc.original_name}</span>
                          </div>
                        </td>
                        <td className="text-sm">{doc.folder ? <span className="slds-badge capitalize">{doc.folder}</span> : "-"}</td>
                        <td className="text-sm text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDownload(doc)}
                              className="slds-btn slds-btn--icon"
                              title={t("documents.download")}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteTarget(doc); setDeleteOpen(true) }}
                              className="slds-btn slds-btn--icon text-red-500 hover:text-red-700 dark:hover:text-red-400"
                              title={t("common.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={uploadOpen} onClose={() => { setUploadOpen(false); setUploadFile(null); setUploadFolder("") }} title={t("documents.uploadFile")}>
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              dragOver
                ? "border-brand bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            {uploadFile ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 text-brand mx-auto" />
                <p className="text-sm font-medium">{uploadFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null) }} className="text-xs text-brand hover:underline">
                  {t("common.remove")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">{t("documents.dragDrop")}</p>
                <p className="text-xs text-muted-foreground">{t("documents.clickToBrowse")}</p>
              </div>
            )}
          </div>

          <div>
            <label className="slds-label" htmlFor="doc-folder">{t("documents.folder")}</label>
            <select id="doc-folder" className="slds-input" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {FOLDERS.filter((f) => f !== "All").map((f) => (
                <option key={f} value={f.toLowerCase()}>{f}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadFolder("") }} className="slds-btn slds-btn--neutral">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={!uploadFile || uploading} className="slds-btn slds-btn--brand">
              {uploading ? t("app.loading") : t("documents.upload")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={t("documents.deleteDocument")}
        message={deleteTarget ? t("documents.deleteDocumentMessage", { name: deleteTarget.original_name }) : ""}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
