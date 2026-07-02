"use client"

import { useState, useEffect } from "react"
import { Modal } from "@/components/ui/modal"
import { useI18n } from "@/contexts/i18n-context"

interface CompanyFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  initialData?: any
}

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Manufacturing",
  "Retail",
  "Education",
  "Other",
]

export function CompanyForm({ isOpen, onClose, onSubmit, initialData }: CompanyFormProps) {
  const { t } = useI18n()
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [website, setWebsite] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? "")
      setIndustry(initialData.industry ?? "")
      setWebsite(initialData.website ?? "")
      setEmail(initialData.email ?? "")
      setPhone(initialData.phone ?? "")
      setAddress(initialData.address ?? "")
      setCity(initialData.city ?? "")
      setCountry(initialData.country ?? "")
      setNotes(initialData.notes ?? "")
    } else {
      setName("")
      setIndustry("")
      setWebsite("")
      setEmail("")
      setPhone("")
      setAddress("")
      setCity("")
      setCountry("")
      setNotes("")
    }
  }, [initialData, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({
        name,
        industry: industry || undefined,
        website: website || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        city: city || undefined,
        country: country || undefined,
        notes: notes || undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t("companies.editCompany") : t("companies.newCompany")} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="slds-label" htmlFor="name">
            {t("companies.companyName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            className="slds-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="slds-label" htmlFor="industry">{t("companies.industry")}</label>
          <select
            id="industry"
            className="slds-input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">{t("companies.selectIndustry")}</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="website">{t("companies.website")}</label>
            <input
              id="website"
              type="url"
              className="slds-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="email">{t("companies.email")}</label>
            <input
              id="email"
              type="email"
              className="slds-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="phone">{t("companies.phone")}</label>
            <input
              id="phone"
              type="tel"
              className="slds-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="address">{t("companies.address")}</label>
            <input
              id="address"
              className="slds-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="city">{t("companies.city")}</label>
            <input
              id="city"
              className="slds-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="country">{t("companies.country")}</label>
            <input
              id="country"
              className="slds-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="slds-label" htmlFor="notes">{t("companies.notes")}</label>
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
            {loading ? t("companies.saving") : initialData ? t("companies.editCompany") : t("companies.newCompany")}
          </button>
        </div>
      </form>
    </Modal>
  )
}
