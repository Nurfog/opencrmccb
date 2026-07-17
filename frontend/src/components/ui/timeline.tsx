"use client"

import { useEffect, useState } from "react"
import { Phone, Mail, Calendar, FileText, CheckCircle, Plus, Edit, Trash2 } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { auditApi, type AuditEvent, type Activity as ActivityType } from "@/lib/api"
import { formatDate, cn } from "@/lib/utils"

interface TimelineProps {
  entityType: string
  entityId: string
  activities: ActivityType[]
}

interface TimelineItem {
  id: string
  type: "audit" | "activity"
  action: string
  description: string
  timestamp: string
  icon: typeof Phone
  color: string
}

export function Timeline({ entityType, entityId, activities }: TimelineProps) {
  const { t } = useI18n()
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const logs = await auditApi.entityHistory(entityType, entityId)
        setAuditLogs(logs)
      } catch {
        // Audit may fail if user lacks permission — show activities only
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [entityType, entityId])

  const getAuditIcon = (action: string) => {
    if (action.includes("create")) return Plus
    if (action.includes("update") || action.includes("stage")) return Edit
    if (action.includes("delete")) return Trash2
    return FileText
  }

  const getAuditColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    if (action.includes("update") || action.includes("stage")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    if (action.includes("delete")) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }

  const getActivityIcon = (type: string) => {
    if (type === "call") return Phone
    if (type === "email") return Mail
    return Calendar
  }

  const getActivityColor = (completed: boolean) => {
    return completed
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  }

  const items: TimelineItem[] = [
    ...auditLogs.map((log) => ({
      id: log.id,
      type: "audit" as const,
      action: log.action,
      description: formatAuditAction(log),
      timestamp: log.created_at,
      icon: getAuditIcon(log.action),
      color: getAuditColor(log.action),
    })),
    ...activities.map((act) => ({
      id: act.id,
      type: "activity" as const,
      action: act.activity_type,
      description: act.subject + (act.description ? ` — ${act.description}` : ""),
      timestamp: act.due_date || act.created_at,
      icon: getActivityIcon(act.activity_type),
      color: getActivityColor(act.completed),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  function formatAuditAction(log: AuditEvent): string {
    const action = log.action.replace("_", " ")
    if (log.old_values && log.new_values) {
      const changedKeys = Object.keys(log.new_values).filter(
        (k) => JSON.stringify(log.old_values?.[k]) !== JSON.stringify(log.new_values?.[k])
      )
      if (changedKeys.length > 0) {
        return `${action}: ${changedKeys.join(", ")}`
      }
    }
    return action
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("common.noResults")}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.id} className="relative flex items-start gap-3 pl-1">
              <div className={cn("relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", item.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.type === "activity" && (
                    <span className="capitalize">{item.action}</span>
                  )}
                  {item.type === "activity" && " • "}
                  {formatDate(item.timestamp)}
                </p>
              </div>
              {item.type === "activity" && (
                <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
