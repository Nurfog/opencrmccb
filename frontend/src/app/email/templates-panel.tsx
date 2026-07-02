"use client"

import { FileText, Plus, Send, Trash2 } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { type EmailTemplate } from "@/lib/api"

export interface TemplateDraft {
  name: string
  subject: string
  body: string
  category: string
}

interface TemplatesPanelProps {
  templates: EmailTemplate[]
  loading: boolean
  sending: boolean
  formOpen: boolean
  editingTemplate: EmailTemplate | null
  draft: TemplateDraft
  onDraftChange: (draft: TemplateDraft) => void
  onNewTemplate: () => void
  onCancelForm: () => void
  onEditTemplate: (template: EmailTemplate) => void
  onDeleteTemplate: (id: string) => void
  onSendTemplate: (template: EmailTemplate) => void
  onSaveTemplate: (event: React.FormEvent) => void
}

const TEMPLATE_CATEGORIES = ["general", "follow-up", "proposal", "thank-you"] as const

export function TemplatesPanel({
  templates,
  loading,
  sending,
  formOpen,
  editingTemplate,
  draft,
  onDraftChange,
  onNewTemplate,
  onCancelForm,
  onEditTemplate,
  onDeleteTemplate,
  onSendTemplate,
  onSaveTemplate,
}: TemplatesPanelProps) {
  const { t } = useI18n()

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={onNewTemplate} className="slds-btn slds-btn--brand flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("email.newTemplate")}
        </button>
      </div>

      {formOpen && (
        <div className="slds-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            {editingTemplate ? t("email.editTemplate") : t("email.newTemplate")}
          </h3>
          <form onSubmit={onSaveTemplate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="slds-label" htmlFor="template-name">
                  {t("email.templateName")} *
                </label>
                <input
                  id="template-name"
                  type="text"
                  required
                  value={draft.name}
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                  className="slds-input"
                />
              </div>
              <div>
                <label className="slds-label" htmlFor="template-category">
                  {t("email.category")}
                </label>
                <select
                  id="template-category"
                  value={draft.category}
                  onChange={(event) => onDraftChange({ ...draft, category: event.target.value })}
                  className="slds-input"
                >
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {t(`email.categories.${category.replace("-", "_")}` as Parameters<typeof t>[0])}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="slds-label" htmlFor="template-subject">
                {t("email.templateSubject")} *
              </label>
              <input
                id="template-subject"
                type="text"
                required
                value={draft.subject}
                onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })}
                className="slds-input"
              />
            </div>

            <div>
              <label className="slds-label" htmlFor="template-body">
                {t("email.templateBody")} * ({t("email.useVariable")})
              </label>
              <textarea
                id="template-body"
                rows={8}
                required
                value={draft.body}
                onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
                className="slds-input resize-y font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCancelForm} className="slds-btn slds-btn--neutral">
                {t("common.cancel")}
              </button>
              <button type="submit" className="slds-btn slds-btn--brand">
                {editingTemplate ? t("common.update") : t("common.create")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="slds-card col-span-full py-8 text-center text-muted-foreground">{t("email.loading")}</div>
        ) : templates.length === 0 ? (
          <div className="slds-card col-span-full py-8 text-center text-muted-foreground">{t("email.noEmails")}</div>
        ) : (
          templates.map((template) => (
            <article key={template.id} className="slds-card p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground">{template.name}</h3>
                  <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground dark:bg-gray-700">
                    {template.category}
                  </span>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onSendTemplate(template)}
                    disabled={sending}
                    className="rounded p-1.5 text-brand hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/20"
                    title={t("common.send")}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditTemplate(template)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={t("common.edit")}
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(template.id)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mb-2 truncate text-sm text-muted-foreground">
                {t("email.subject")}: {template.subject}
              </p>
              <p className="line-clamp-3 text-xs text-muted-foreground">{template.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

