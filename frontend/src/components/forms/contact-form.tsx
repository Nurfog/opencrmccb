"use client"

import { useState, useEffect } from "react"
import { Modal } from "@/components/ui/modal"
import { CompanyAsyncSelect } from "@/components/ui/company-async-select"
import { type Company } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  initialData?: any
}

export function ContactForm({ isOpen, onClose, onSubmit, initialData }: ContactFormProps) {
  const { t } = useI18n()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [position, setPosition] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.first_name ?? "")
      setLastName(initialData.last_name ?? "")
      setEmail(initialData.email ?? "")
      setPhone(initialData.phone ?? "")
      setPosition(initialData.position ?? "")
      setNotes(initialData.notes ?? "")
      if (initialData.company_id) {
        setSelectedCompany({ id: initialData.company_id, name: initialData.company_name ?? "" } as Company)
      } else {
        setSelectedCompany(null)
      }
    } else {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setPosition("")
      setNotes("")
      setSelectedCompany(null)
    }
  }, [initialData, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        phone: phone || undefined,
        position: position || undefined,
        notes: notes || undefined,
      }
      if (selectedCompany) {
        payload.company_id = selectedCompany.id
      }
      await onSubmit(payload)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t("contacts.editContact") : t("contacts.newContact")} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="firstName">
              {t("contacts.firstName")} <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              className="slds-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="lastName">
              {t("contacts.lastName")} <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              className="slds-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="email">{t("contacts.email")}</label>
            <input
              id="email"
              type="email"
              className="slds-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="phone">{t("contacts.phone")}</label>
            <input
              id="phone"
              type="tel"
              className="slds-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="slds-label" htmlFor="position">{t("contacts.position")}</label>
          <input
            id="position"
            className="slds-input"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>

        <CompanyAsyncSelect
          value={selectedCompany}
          onChange={setSelectedCompany}
        />

        <div>
          <label className="slds-label" htmlFor="notes">{t("contacts.notes")}</label>
          <textarea
            id="notes"
            className="slds-input min-h-[80px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="slds-btn">
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={loading} className="slds-btn slds-btn--brand">
            {loading ? (initialData ? t("contacts.updating") : t("contacts.creating")) : (initialData ? t("contacts.editContact") : t("contacts.newContact"))}
          </button>
        </div>
      </form>
    </Modal>
  )
}
