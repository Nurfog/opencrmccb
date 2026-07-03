"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { DollarSign, Users, Building2, TrendingUp, TrendingDown, Briefcase, BarChart3, Activity, Target, Plus, ArrowRight, Phone, Mail, Calendar, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/contexts/toast-context"
import { dashboardApi, dealsApi, type DashboardStats, type PipelineStage, type TopDeal, type RecentActivity } from "@/lib/api"

const PipelineBarChart = dynamic(() => import("@/components/charts/pipeline-bar-chart").then((m) => m.PipelineBarChart), { ssr: false })
import { DealForm } from "@/components/forms/deal-form"
import { Modal } from "@/components/ui/modal"
import { DashboardSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatNumber, formatDate, getInitials } from "@/lib/utils"

const activityIcons: Record<string, typeof Activity> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: FileText,
}

const activityColors: Record<string, string> = {
  call: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  email: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  meeting: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  task: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
}

export default function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const { success, error } = useToast()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [topDeals, setTopDeals] = useState<TopDeal[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [dealModalOpen, setDealModalOpen] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const [statsData, pipelineData, topDealsData, activitiesData] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.pipeline(),
        dashboardApi.topDeals(),
        dashboardApi.recentActivities(),
      ])
      setStats(statsData)
      setPipeline(pipelineData.stages)
      setTopDeals(topDealsData.deals)
      setRecentActivities(activitiesData.activities)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleCreateDeal = async (data: Record<string, unknown>) => {
    try {
      await dealsApi.create(data as Parameters<typeof dealsApi.create>[0])
      success(t("toast.created", { entity: t("deals.dealName") }))
      setDealModalOpen(false)
      fetchStats()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "create", entity: t("deals.dealName") })
      error(msg)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    )
  }

  if (errorState) {
    return (
      <AppLayout>
        <div className="animate-fade-in space-y-6">
          <div className="slds-header">
            <div>
              <h1 className="slds-header__title">{t("dashboard.title")}</h1>
            </div>
          </div>
          <EmptyState
            icon={BarChart3}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchStats }}
          />
        </div>
      </AppLayout>
    )
  }

  const statCards = [
    { label: t("dashboard.totalRevenue"), value: formatCurrency(stats?.total_revenue ?? 0), icon: DollarSign, color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
    { label: t("dashboard.contacts"), value: formatNumber(stats?.total_contacts ?? 0), icon: Users, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { label: t("dashboard.companies"), value: formatNumber(stats?.total_companies ?? 0), icon: Building2, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
    { label: t("dashboard.activeDeals"), value: formatNumber(stats?.active_deals ?? 0), icon: Briefcase, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" },
  ]

  const miniStats = [
    { label: t("dashboard.wonDeals"), value: formatNumber(stats?.won_deals ?? 0), icon: TrendingUp, color: "text-green-600 dark:text-green-400" },
    { label: t("dashboard.lostDeals"), value: formatNumber(stats?.lost_deals ?? 0), icon: TrendingDown, color: "text-red-600 dark:text-red-400" },
    { label: t("dashboard.totalDeals"), value: formatNumber(stats?.total_deals ?? 0), icon: Target, color: "text-blue-600 dark:text-blue-400" },
  ]

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("dashboard.title")}</h1>
            {user && (
              <p className="slds-header__description">{t("dashboard.welcome", { name: `${user.first_name} ${user.last_name}` })}</p>
            )}
          </div>
          <button type="button" onClick={() => setDealModalOpen(true)} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("dashboard.createDeal")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
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

        <div className="flex flex-wrap gap-4">
          {miniStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="slds-card p-4">
              <h3 className="text-base font-semibold mb-4">{t("dashboard.pipelineOverview")}</h3>
              <div className="h-64">
                <PipelineBarChart
                  stages={pipeline.map((s) => ({
                    stage: s.stage,
                    count: s.count,
                    total_value: s.total_value,
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="slds-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{t("dashboard.recentActivities")}</h3>
            </div>
            <div className="space-y-0">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("common.noResults")}</p>
              ) : (
                recentActivities.slice(0, 5).map((activity, idx) => {
                  const Icon = activityIcons[activity.activity_type] ?? Activity
                  const colorClass = activityColors[activity.activity_type] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  return (
                    <div key={activity.id ?? idx} className="flex gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.subject}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.created_at ? formatDate(activity.created_at) : ""}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="slds-card">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold">{t("dashboard.topDeals")}</h3>
          </div>
          {topDeals.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Briefcase}
                title={t("deals.noDeals")}
                action={{ label: t("dashboard.createDeal"), onClick: () => setDealModalOpen(true) }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="slds-table">
                <thead>
                  <tr>
                    <th>{t("deals.dealName")}</th>
                    <th>{t("deals.amount")}</th>
                    <th>{t("deals.stage")}</th>
                    <th>{t("deals.expectedCloseDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td className="font-medium">{deal.title}</td>
                      <td>{formatCurrency(deal.value)}</td>
                      <td>
                        <span className="slds-badge">{deal.stage}</span>
                      </td>
                      <td className="text-muted-foreground">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DealForm
        isOpen={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        onSubmit={handleCreateDeal}
      />
    </AppLayout>
  )
}
