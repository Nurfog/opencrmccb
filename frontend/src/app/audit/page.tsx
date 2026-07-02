"use client"

import { useState, useEffect, useCallback } from "react"
import { Activity, Shield, Edit, Trash2, Plus, LogIn, Search, X } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { auditApi, type AuditEvent } from "@/lib/api"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDateTime, cn } from "@/lib/utils"

const actionColors: Record<string, string> = {
  create: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  update: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  delete: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  login: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  view: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
}

const actionIcons: Record<string, typeof Shield> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  login: LogIn,
  view: Activity,
}

const entityColors: Record<string, string> = {
  contact: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  company: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  deal: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  user: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  document: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
}

export default function AuditPage() {
  const { t } = useI18n()
  const { error } = useToast()

  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [entityFilter, setEntityFilter] = useState<string | null>(null)

  const fetchAudit = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await auditApi.list({
        entity_type: entityFilter ?? undefined,
      })
      setLogs(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [entityFilter, t])

  useEffect(() => {
    fetchAudit()
  }, [fetchAudit])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput("")
    setSearch("")
  }

  const entities = [
    { id: null, label: t("common.all") },
    { id: "contact", label: t("contacts.title") },
    { id: "company", label: t("companies.title") },
    { id: "deal", label: t("deals.title") },
    { id: "user", label: t("settings.profile") },
    { id: "document", label: t("documents.title") },
  ]

  const filteredResults = (logs ?? []).filter((event) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      event.action.toLowerCase().includes(q) ||
      event.entity_type.toLowerCase().includes(q) ||
      String(event.entity_id).includes(q)
    )
  })

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("audit.title")}</h1>
            <p className="slds-header__description">{t("audit.description")}</p>
          </div>
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

        <div className="flex flex-wrap gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("audit.entity")}:</span>
            {entities.map((e) => (
              <button
                key={e.id ?? "all"}
                type="button"
                onClick={() => setEntityFilter(e.id) }
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  entityFilter === e.id
                    ? "bg-brand text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : errorState ? (
          <EmptyState
            icon={Shield}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchAudit }}
          />
        ) : filteredResults.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={t("audit.noEvents")}
          />
        ) : (
          <div className="slds-card">
            {filteredResults.map((event, idx) => {
              const ActionIcon = actionIcons[event.action] ?? Activity
              const actionColor = actionColors[event.action] ?? actionColors.view
              const entityColor = entityColors[event.entity_type] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-start gap-4 p-4",
                    idx < filteredResults.length - 1 && "border-b border-gray-100 dark:border-gray-700"
                  )}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${actionColor}`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{event.action}</span>
                      <span className={cn("slds-badge text-xs", entityColor)}>
                        {t(`${event.entity_type}.title` as any) || event.entity_type}
                      </span>
                      <span className="text-sm text-muted-foreground">#{event.entity_id.slice(0, 8)}</span>
                    </div>
                    {event.new_values && Object.keys(event.new_values).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-xs text-brand cursor-pointer hover:underline">
                          {t("audit.details")}
                        </summary>
                        <pre className="mt-1 text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto">
                          {JSON.stringify(event.new_values, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 min-w-0">
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    {event.ip_address && (
                      <p className="text-xs text-muted-foreground">{event.ip_address}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
