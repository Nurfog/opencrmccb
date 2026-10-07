"use client"

import { useState, useEffect } from "react"
import { Modal } from "@/components/ui/modal"
import { leadsApi, type Lead } from "@/lib/api"
import { useToast } from "@/contexts/toast-context"
import { useI18n } from "@/contexts/i18n-context"

interface LeadFormProps {
  open: boolean
  lead: Lead | null
  onClose: () => void
  onSuccess: () => void
}

export function LeadForm({ open, lead, onClose, onSuccess }: LeadFormProps) {
  const { t } = useI18n()
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [title, setTitle] = useState("")
  const [industry, setIndustry] = useState("")
  const [website, setWebsite] = useState("")
  const [leadSource, setLeadSource] = useState("other")
  const [notes, setNotes] = useState("")

  const LEAD_SOURCES = [
    { value: "web", label: t("leads.sources.web") },
    { value: "referral", label: t("leads.sources.referral") },
    { value: "cold_call", label: t("leads.sources.cold_call") },
    { value: "advertisement", label: t("leads.sources.advertisement") },
    { value: "email", label: t("leads.sources.email") },
    { value: "social", label: t("leads.sources.social") },
    { value: "partner", label: t("leads.sources.partner") },
    { value: "event", label: t("leads.sources.event") },
    { value: "other", label: t("leads.sources.other") },
  ]

  useEffect(() => {
    if (lead) {
      setFirstName(lead.first_name)
      setLastName(lead.last_name)
      setEmail(lead.email || "")
      setPhone(lead.phone || "")
      setCompanyName(lead.company_name || "")
      setTitle(lead.title || "")
      setIndustry(lead.industry || "")
      setWebsite(lead.website || "")
      setLeadSource(lead.lead_source)
      setNotes(lead.notes || "")
    } else {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setCompanyName("")
      setTitle("")
      setIndustry("")
      setWebsite("")
      setLeadSource("other")
      setNotes("")
    }
  }, [lead, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        phone: phone || undefined,
        company_name: companyName || undefined,
        title: title || undefined,
        industry: industry || undefined,
        website: website || undefined,
        lead_source: leadSource,
        notes: notes || undefined,
      }

      if (lead) {
        await leadsApi.update(lead.id, data)
        success(t("leads.leadUpdated"))
      } else {
        await leadsApi.create(data)
        success(t("leads.leadCreated"))
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("leads.errorSaving")
      error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={lead ? t("leads.editLead") : t("leads.newLead")}
      size="lg"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="slds-label">
                {t("leads.firstName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="slds-input"
              />
            </div>
            <div>
              <label className="slds-label">
                {t("leads.lastName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="slds-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="slds-label">
                {t("leads.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="slds-input"
              />
            </div>
            <div>
              <label className="slds-label">
                {t("leads.phone")}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="slds-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="slds-label">
                {t("leads.company")}
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="slds-input"
              />
            </div>
            <div>
              <label className="slds-label">
                {t("leads.title")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="slds-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="slds-label">
                {t("leads.industry")}
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="slds-input"
              />
            </div>
            <div>
              <label className="slds-label">
                {t("leads.website")}
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="slds-input"
              />
            </div>
          </div>

          <div>
            <label className="slds-label">
              {t("leads.source")}
            </label>
            <select
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className="slds-input"
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="slds-label">
              {t("leads.notes")}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="slds-input min-h-[80px] resize-none"
            />
          </div>

          <div className="slds-modal__footer">
            <button
              type="button"
              onClick={onClose}
              className="slds-btn slds-btn--neutral"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="slds-btn slds-btn--brand disabled:opacity-50"
            >
              {loading ? t("common.loading") : lead ? t("common.update") : t("common.create")}
            </button>
          </div>
        </form>
    </Modal>
  )
}
