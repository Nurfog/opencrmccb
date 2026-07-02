"use client"

import { useEffect, useState, useCallback } from "react"
import { BarChart3, CircleDollarSign, TrendingUp, TrendingDown, Target } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { reportsApi } from "@/lib/api"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPercentage, cn } from "@/lib/utils"

interface PipelineReport {
  stages: { stage: string; count: number; total_value: number; avg_value: number; percentage: number }[]
  total_deals: number
  total_value: number
}

interface WinLossReport {
  won_count: number
  lost_count: number
  win_rate: number
  loss_rate: number
  won_value: number
  lost_value: number
  total_closed: number
}

export default function ReportsPage() {
  const { t } = useI18n()

  const [pipelineReport, setPipelineReport] = useState<PipelineReport | null>(null)
  const [winLossReport, setWinLossReport] = useState<WinLossReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const [pipelineRes, winLossRes] = await Promise.all([
        reportsApi.pipeline(),
        reportsApi.winLoss(),
      ])
      setPipelineReport(pipelineRes as PipelineReport)
      setWinLossReport(winLossRes as WinLossReport)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalDeals = pipelineReport?.total_deals ?? 0
  const totalRevenue = pipelineReport?.total_value ?? 0
  const winRate = winLossReport?.win_rate ?? 0
  const lossRate = winLossReport?.loss_rate ?? 0

  const summaryCards = [
    { label: t("reports.totalDeals"), value: String(totalDeals), icon: Target, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: t("reports.totalValue"), value: formatCurrency(totalRevenue), icon: CircleDollarSign, color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
    { label: t("reports.winRate"), value: formatPercentage(winRate), icon: TrendingUp, color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
    { label: t("reports.lossRate"), value: formatPercentage(lossRate), icon: TrendingDown, color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
  ]

  const maxPipelineValue = Math.max(...(pipelineReport?.stages.map(s => s.total_value) ?? [1]), 1)

  const stageColors: Record<string, string> = {
    lead: "bg-gray-400",
    qualified: "bg-blue-500",
    proposal: "bg-purple-500",
    negotiation: "bg-orange-500",
    closed_won: "bg-green-500",
    closed_lost: "bg-red-500",
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-fade-in space-y-6">
          <div className="slds-header">
            <div>
              <h1 className="slds-header__title">{t("reports.title")}</h1>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="slds-card p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="slds-card p-4 space-y-4">
            <Skeleton className="h-6 w-48" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (errorState) {
    return (
      <AppLayout>
        <div className="animate-fade-in space-y-6">
          <div className="slds-header">
            <div>
              <h1 className="slds-header__title">{t("reports.title")}</h1>
            </div>
          </div>
          <EmptyState
            icon={BarChart3}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchData }}
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("reports.title")}</h1>
            <p className="slds-header__description">{t("reports.description")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="slds-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="slds-card p-4">
            <h3 className="text-base font-semibold mb-4">{t("reports.pipelineBreakdown")}</h3>
            {!pipelineReport || pipelineReport.stages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("common.noResults")}</p>
            ) : (
              <div className="space-y-4">
                {pipelineReport.stages.map((item) => {
                  const pct = maxPipelineValue > 0 ? (item.total_value / maxPipelineValue) * 100 : 0
                  return (
                    <div key={item.stage} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{t(`stages.${item.stage}` as any) || item.stage}</span>
                        <span className="text-muted-foreground">{item.count} {t("deals.title")} / {formatCurrency(item.total_value)}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", stageColors[item.stage] ?? "bg-brand")}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="slds-card p-4">
            <h3 className="text-base font-semibold mb-4">{t("reports.winLossAnalysis")}</h3>
            {!winLossReport ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("common.noResults")}</p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center border border-green-200 dark:border-green-800">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{winLossReport.won_count}</p>
                    <p className="text-xs text-muted-foreground">{t("reports.wonDeals")}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center border border-red-200 dark:border-red-800">
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{winLossReport.lost_count}</p>
                    <p className="text-xs text-muted-foreground">{t("reports.lostDeals")}</p>
                  </div>
                </div>
                {winLossReport.total_closed > 0 && (
                  <>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 h-full transition-all duration-500"
                        style={{ width: `${winRate}%` }}
                      />
                      <div
                        className="bg-red-500 h-full transition-all duration-500"
                        style={{ width: `${lossRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("reports.winRate")}: {formatPercentage(winRate)}</span>
                      <span>{t("reports.lossRate")}: {formatPercentage(lossRate)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
