"use client"

import { Pagination } from "@/components/ui/pagination"
import { useI18n } from "@/contexts/i18n-context"
import { type EmailLog, type PaginatedResponse } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { StatusIcon } from "./status-icon"

interface LogsPanelProps {
  logs: PaginatedResponse<EmailLog> | null
  loading: boolean
  onPageChange: (page: number) => void
}

const LOGS_PER_PAGE = 20

export function LogsPanel({ logs, loading, onPageChange }: LogsPanelProps) {
  const { t } = useI18n()

  return (
    <section className="slds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                {t("email.logStatus")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                {t("email.logTo")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                {t("email.logSubject")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                {t("email.logDate")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {t("email.loading")}
                </td>
              </tr>
            ) : !logs || logs.data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {t("email.noEmails")}
                </td>
              </tr>
            ) : (
              logs.data.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <StatusIcon status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{log.to_email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.subject}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(log.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {logs && logs.total_pages > 1 && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <Pagination
            page={logs.page}
            totalPages={logs.total_pages}
            total={logs.total}
            perPage={LOGS_PER_PAGE}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </section>
  )
}

