"use client"

import { useState } from "react"
import { GitBranch, Users, Palette, UserCog, Webhook } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useI18n } from "@/contexts/i18n-context"
import { cn } from "@/lib/utils"
import { PipelinesSection } from "@/components/admin/pipelines-section"
import { ProfilesSection } from "@/components/admin/profiles-section"
import { UsersSection } from "@/components/admin/users-section"
import { BrandingSection } from "@/components/admin/branding-section"
import { WebhooksSection } from "@/components/admin/webhooks-section"

type AdminTab = "pipelines" | "profiles" | "branding" | "users" | "webhooks"

export default function AdminPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<AdminTab>("pipelines")

  const tabs = [
    { id: "pipelines" as AdminTab, label: t("admin.pipelines"), icon: GitBranch },
    { id: "profiles" as AdminTab, label: t("admin.profiles"), icon: Users },
    { id: "users" as AdminTab, label: t("admin.users"), icon: UserCog },
    { id: "branding" as AdminTab, label: t("admin.branding"), icon: Palette },
    { id: "webhooks" as AdminTab, label: t("admin.webhooks"), icon: Webhook },
  ]

  return (
    <ProtectedRoute requiredPermission="admin.access">
      <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("admin.title")}</h1>
            <p className="slds-header__description">{t("admin.description")}</p>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="slds-card p-6">
          {activeTab === "pipelines" && <PipelinesSection />}
          {activeTab === "profiles" && <ProfilesSection />}
          {activeTab === "users" && <UsersSection />}
          {activeTab === "branding" && <BrandingSection />}
          {activeTab === "webhooks" && <WebhooksSection />}
        </div>
      </div>
    </AppLayout>
    </ProtectedRoute>
  )
}
