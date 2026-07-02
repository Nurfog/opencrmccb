"use client"

import { useState } from "react"
import { HelpCircle, BookOpen, Mail, ChevronDown, ChevronUp, ExternalLink, MessageCircle, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { cn } from "@/lib/utils"

const faqs = [
  { q: "help.faq1", a: "help.faq1a" },
  { q: "help.faq2", a: "help.faq2a" },
  { q: "help.faq3", a: "help.faq3a" },
  { q: "help.faq4", a: "help.faq4a" },
  { q: "help.faq5", a: "help.faq5a" },
]

export default function HelpPage() {
  const { t } = useI18n()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("help.title")}</h1>
            <p className="slds-header__description">{t("help.description")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="slds-card p-6 text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base font-semibold">{t("help.documentation")}</h3>
            <p className="text-sm text-muted-foreground">{t("help.documentationDesc")}</p>
            <a
              href="https://docs.opencrm.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="slds-btn slds-btn--neutral inline-flex items-center gap-2"
            >
              {t("help.viewDocs")}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="slds-card p-6 text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-base font-semibold">{t("help.emailSupport")}</h3>
            <p className="text-sm text-muted-foreground">{t("help.emailSupportDesc")}</p>
            <a
              href="mailto:support@opencrm.ai"
              className="slds-btn slds-btn--neutral inline-flex items-center gap-2"
            >
              {t("help.sendEmail")}
              <Mail className="h-4 w-4" />
            </a>
          </div>

          <div className="slds-card p-6 text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto">
              <MessageCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-base font-semibold">{t("help.community")}</h3>
            <p className="text-sm text-muted-foreground">{t("help.communityDesc")}</p>
            <a
              href="https://community.opencrm.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="slds-btn slds-btn--neutral inline-flex items-center gap-2"
            >
              {t("help.joinCommunity")}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="slds-card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-brand" />
              {t("help.faq")}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {faqs.map((faq, idx) => (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-sm font-medium pr-4">{t(faq.q)}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    openFaq === idx ? "max-h-96" : "max-h-0"
                  )}
                >
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(faq.a)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="slds-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1">{t("help.ticketTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-3">{t("help.ticketDesc")}</p>
              <a
                href="https://support.opencrm.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="slds-btn slds-btn--brand inline-flex items-center gap-2"
              >
                {t("help.createTicket")}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
