"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { emailApi, type EmailLog, type EmailTemplate, type PaginatedResponse } from "@/lib/api"
import { cn } from "@/lib/utils"
import { ComposePanel } from "./compose-panel"
import { LogsPanel } from "./logs-panel"
import { TemplatesPanel, type TemplateDraft } from "./templates-panel"
import { type EmailTab } from "./types"

const EMAIL_TABS: EmailTab[] = ["compose", "logs", "templates"]
const EMPTY_TEMPLATE: TemplateDraft = {
  name: "",
  subject: "",
  body: "",
  category: "general",
}

export default function EmailPage() {
  const { t } = useI18n()
  const { success, error } = useToast()
  const [tab, setTab] = useState<EmailTab>("compose")

  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  const [logs, setLogs] = useState<PaginatedResponse<EmailLog> | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE)

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await emailApi.listLogs({ page: logsPage, per_page: 20 })
      setLogs(res)
    } catch {
      // The page keeps the current empty state and lets future refreshes recover.
    } finally {
      setLogsLoading(false)
    }
  }, [logsPage])

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await emailApi.listTemplates()
      setTemplates(res)
    } catch {
      // The templates grid renders its empty state when loading fails.
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "logs") fetchLogs()
    if (tab === "templates") fetchTemplates()
  }, [tab, fetchLogs, fetchTemplates])

  const resetTemplateForm = () => {
    setEditingTemplate(null)
    setTemplateDraft(EMPTY_TEMPLATE)
  }

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    try {
      await emailApi.send({ to, subject, body })
      success(t("email.emailSent"))
      setTo("")
      setSubject("")
      setBody("")
      setTab("logs")
    } catch (err) {
      error(err instanceof Error ? err.message : t("email.failedToSend"))
    } finally {
      setSending(false)
    }
  }

  const handleSendFromTemplate = async (template: EmailTemplate) => {
    if (!to) {
      error(t("email.enterRecipient"))
      return
    }

    setSending(true)
    try {
      await emailApi.sendFromTemplate(template.id, { to })
      success(t("email.emailSentFromTemplate", { name: template.name }))
      setTab("logs")
    } catch (err) {
      error(err instanceof Error ? err.message : t("email.failedToSend"))
    } finally {
      setSending(false)
    }
  }

  const handleSaveTemplate = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (editingTemplate) {
        await emailApi.updateTemplate(editingTemplate.id, templateDraft)
        success(t("email.templateUpdated"))
      } else {
        await emailApi.createTemplate(templateDraft)
        success(t("email.templateCreated"))
      }

      setTemplateFormOpen(false)
      resetTemplateForm()
      fetchTemplates()
    } catch (err) {
      error(err instanceof Error ? err.message : t("email.errorSavingTemplate"))
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await emailApi.deleteTemplate(id)
      success(t("email.templateDeleted"))
      fetchTemplates()
    } catch {
      error(t("email.errorDeletingTemplate"))
    }
  }

  const handleNewTemplate = () => {
    resetTemplateForm()
    setTemplateFormOpen(true)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setTemplateDraft({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
    })
    setTemplateFormOpen(true)
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6 p-6">
        <header className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("email.title")}</h1>
            <p className="slds-header__description">{t("email.description")}</p>
          </div>
          <div className="hidden items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-muted-foreground dark:border-gray-700 md:flex">
            <Mail className="h-4 w-4" />
            {t("nav.email")}
          </div>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700" aria-label={t("nav.email")}>
          {EMAIL_TABS.map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === tabKey
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground dark:hover:border-gray-600"
              )}
            >
              {t(`email.${tabKey}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </nav>

        {tab === "compose" && (
          <ComposePanel
            to={to}
            subject={subject}
            body={body}
            sending={sending}
            onToChange={setTo}
            onSubjectChange={setSubject}
            onBodyChange={setBody}
            onSubmit={handleSend}
          />
        )}

        {tab === "logs" && <LogsPanel logs={logs} loading={logsLoading} onPageChange={setLogsPage} />}

        {tab === "templates" && (
          <TemplatesPanel
            templates={templates}
            loading={templatesLoading}
            sending={sending}
            formOpen={templateFormOpen}
            editingTemplate={editingTemplate}
            draft={templateDraft}
            onDraftChange={setTemplateDraft}
            onNewTemplate={handleNewTemplate}
            onCancelForm={() => setTemplateFormOpen(false)}
            onEditTemplate={handleEditTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onSendTemplate={handleSendFromTemplate}
            onSaveTemplate={handleSaveTemplate}
          />
        )}
      </div>
    </AppLayout>
  )
}

