"use client"

import { Send } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"

interface ComposePanelProps {
  to: string
  subject: string
  body: string
  sending: boolean
  onToChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

export function ComposePanel({
  to,
  subject,
  body,
  sending,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onSubmit,
}: ComposePanelProps) {
  const { t } = useI18n()

  return (
    <section className="slds-card max-w-3xl p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("email.newEmail")}</h2>
          <p className="text-sm text-muted-foreground">{t("email.description")}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="slds-label" htmlFor="email-to">
            {t("email.to")} *
          </label>
          <input
            id="email-to"
            type="email"
            required
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            placeholder="recipient@example.com"
            className="slds-input"
          />
        </div>

        <div>
          <label className="slds-label" htmlFor="email-subject">
            {t("email.subject")} *
          </label>
          <input
            id="email-subject"
            type="text"
            required
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            className="slds-input"
          />
        </div>

        <div>
          <label className="slds-label" htmlFor="email-body">
            {t("email.body")} *
          </label>
          <textarea
            id="email-body"
            required
            rows={10}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            className="slds-input min-h-[15rem] resize-y font-mono text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Send className="h-4 w-4" />
            {sending ? t("email.sending") : t("email.sendEmail")}
          </button>
        </div>
      </form>
    </section>
  )
}

