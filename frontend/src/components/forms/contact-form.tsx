"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Search, Building2 } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { companiesApi, type Company } from "@/lib/api"
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
  const [companySearch, setCompanySearch] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyResults, setCompanyResults] = useState<Company[]>([])
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const companyRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        setCompanySearch(initialData.company_name ?? "")
      }
    } else {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setPosition("")
      setNotes("")
      setCompanySearch("")
      setSelectedCompany(null)
      setCompanyResults([])
    }
  }, [initialData, isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchCompanies = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCompanyResults([])
      return
    }
    try {
      const res = await companiesApi.list({ search: query })
      setCompanyResults(res.data)
    } catch {
      setCompanyResults([])
    }
  }, [])

  const handleCompanyInputChange = (value: string) => {
    setCompanySearch(value)
    setSelectedCompany(null)
    setCompanyDropdownOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCompanies(value), 300)
  }

  const selectCompany = (company: Company) => {
    setSelectedCompany(company)
    setCompanySearch(company.name)
    setCompanyDropdownOpen(false)
  }

  const clearCompany = () => {
    setSelectedCompany(null)
    setCompanySearch("")
    setCompanyResults([])
  }

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

        <div ref={companyRef} className="relative">
          <label className="slds-label" htmlFor="companySearch">{t("contacts.company")}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="companySearch"
              className="slds-input pl-10"
              value={companySearch}
              onChange={(e) => handleCompanyInputChange(e.target.value)}
              onFocus={() => {
                if (companyResults.length > 0) setCompanyDropdownOpen(true)
              }}
              placeholder={t("companies.searchCompanies")}
            />
            {selectedCompany && (
              <button
                type="button"
                onClick={clearCompany}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {companyDropdownOpen && companyResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {companyResults.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => selectCompany(company)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                >
                  <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{company.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
