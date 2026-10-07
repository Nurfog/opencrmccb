"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Search, User, Building2, Plus, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { contactsApi, companiesApi, type Contact, type Company, type Deal } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"

interface DealFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>
  initialData?: (Partial<Deal> & { contact_name?: string; company_name?: string }) | undefined
}

const CURRENCIES = ["USD", "EUR", "GBP", "CLP"]

const STAGES = [
  { id: "lead", name: "Lead" },
  { id: "qualified", name: "Qualified" },
  { id: "proposal", name: "Proposal" },
  { id: "negotiation", name: "Negotiation" },
  { id: "closed_won", name: "Closed Won" },
  { id: "closed_lost", name: "Closed Lost" },
]

interface SearchDropdownProps<T> {
  value: string
  onChange: (value: string) => void
  results: T[]
  onSelect: (item: T) => void
  selected: T | null
  onClear: () => void
  dropdownOpen: boolean
  placeholder: string
  renderItem: (item: T) => React.ReactNode
  wrapperRef: React.RefObject<HTMLDivElement | null>
  footerAction?: { label: string; icon: React.ElementType; onClick: () => void }
}

function SearchDropdown<T>({
  value,
  onChange,
  results,
  onSelect,
  selected,
  onClear,
  dropdownOpen,
  placeholder,
  renderItem,
  wrapperRef,
  footerAction,
}: SearchDropdownProps<T>) {
  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="slds-input pl-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {selected && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {dropdownOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-popover border border-border rounded-xl shadow-pop py-1.5 max-h-48 overflow-y-auto animate-fade-in">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full flex items-center gap-2.5 px-3 py-2 mx-1 text-[13.5px] hover:bg-muted text-left rounded-lg transition-colors"
              style={{ width: "calc(100% - 8px)" }}
            >
              {renderItem(item)}
            </button>
          ))}
          {footerAction && (
            <button
              type="button"
              onClick={footerAction.onClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 mx-1 text-[13px] border-t border-border text-primary hover:bg-muted text-left font-medium rounded-lg transition-colors"
              style={{ width: "calc(100% - 8px)" }}
            >
              <footerAction.icon className="h-4 w-4 flex-shrink-0" />
              {footerAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DealForm({ isOpen, onClose, onSubmit, initialData }: DealFormProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [stage, setStage] = useState("")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [notes, setNotes] = useState("")

  const [contactSearch, setContactSearch] = useState("")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false)

  const [companySearch, setCompanySearch] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyResults, setCompanyResults] = useState<Company[]>([])
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)

  const [loading, setLoading] = useState(false)

  const [quickCreateOpen, setQuickCreateOpen] = useState<"contact" | "company" | null>(null)
  const [quickCreateLoading, setQuickCreateLoading] = useState(false)

  const contactRef = useRef<HTMLDivElement>(null)
  const companyRef = useRef<HTMLDivElement>(null)
  const quickContactFormRef = useRef<HTMLDivElement>(null)
  const quickCompanyFormRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contactAbortRef = useRef<AbortController | null>(null)
  const companyAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      contactAbortRef.current?.abort()
      companyAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title ?? "")
      setAmount(initialData.value != null ? String(initialData.value) : "")
      setCurrency(initialData.currency ?? "USD")
      setStage(initialData.stage ?? "")
      setExpectedCloseDate(
        initialData.expected_close_date
          ? initialData.expected_close_date.substring(0, 10)
          : ""
      )
      setNotes(initialData.notes ?? "")
      if (initialData.contact_id) {
        setSelectedContact({ id: initialData.contact_id, first_name: initialData.contact_name ?? "", last_name: "" } as Contact)
        setContactSearch(initialData.contact_name ?? "")
      }
      if (initialData.company_id) {
        setSelectedCompany({ id: initialData.company_id, name: initialData.company_name ?? "" } as Company)
        setCompanySearch(initialData.company_name ?? "")
      }
    } else {
      setTitle("")
      setAmount("")
      setCurrency("USD")
      setStage("")
      setExpectedCloseDate("")
      setNotes("")
      setContactSearch("")
      setSelectedContact(null)
      setContactResults([])
      setCompanySearch("")
      setSelectedCompany(null)
      setCompanyResults([])
    }
  }, [initialData, isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false)
      }
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchContacts = useCallback(async (query: string, signal?: AbortSignal) => {
    if (!query.trim()) {
      setContactResults([])
      return
    }
    try {
      const res = await contactsApi.list({ search: query }, signal)
      if (signal?.aborted) return
      setContactResults(res.data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      if (signal?.aborted) return
      console.error("Failed to search contacts", err)
      setContactResults([])
    }
  }, [])

  const searchCompanies = useCallback(async (query: string, signal?: AbortSignal) => {
    if (!query.trim()) {
      setCompanyResults([])
      return
    }
    try {
      const res = await companiesApi.list({ search: query }, signal)
      if (signal?.aborted) return
      setCompanyResults(res.data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      if (signal?.aborted) return
      console.error("Failed to search companies", err)
      setCompanyResults([])
    }
  }, [])

  const handleContactInputChange = (value: string) => {
    setContactSearch(value)
    setSelectedContact(null)
    setContactDropdownOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    contactAbortRef.current?.abort()
    const controller = new AbortController()
    contactAbortRef.current = controller
    debounceRef.current = setTimeout(() => searchContacts(value, controller.signal), 300)
  }

  const handleCompanyInputChange = (value: string) => {
    setCompanySearch(value)
    setSelectedCompany(null)
    setCompanyDropdownOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    companyAbortRef.current?.abort()
    const controller = new AbortController()
    companyAbortRef.current = controller
    debounceRef.current = setTimeout(() => searchCompanies(value, controller.signal), 300)
  }

  const selectContact = (contact: Contact) => {
    setSelectedContact(contact)
    setContactSearch(`${contact.first_name} ${contact.last_name}`.trim())
    setContactDropdownOpen(false)
  }

  const selectCompany = (company: Company) => {
    setSelectedCompany(company)
    setCompanySearch(company.name)
    setCompanyDropdownOpen(false)
  }

  const clearContact = () => {
    setSelectedContact(null)
    setContactSearch("")
    setContactResults([])
  }

  const clearCompany = () => {
    setSelectedCompany(null)
    setCompanySearch("")
    setCompanyResults([])
  }

  const handleQuickCreateContact = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const form = quickContactFormRef.current
    if (!form) return
    const firstName = (form.querySelector('input[name="first_name"]') as HTMLInputElement)?.value?.trim() ?? ""
    const lastName = (form.querySelector('input[name="last_name"]') as HTMLInputElement)?.value?.trim() ?? ""
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement)?.value?.trim() ?? ""
    if (!firstName || !lastName) return
    setQuickCreateLoading(true)
    try {
      const created = await contactsApi.create({
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
      })
      selectContact(created)
      setQuickCreateOpen(null)
    } catch (err: unknown) {
      console.error("Failed to quick-create contact", err)
    } finally {
      setQuickCreateLoading(false)
    }
  }

  const handleQuickCreateCompany = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const form = quickCompanyFormRef.current
    if (!form) return
    const name = (form.querySelector('input[name="name"]') as HTMLInputElement)?.value?.trim() ?? ""
    if (!name) return
    setQuickCreateLoading(true)
    try {
      const created = await companiesApi.create({ name })
      selectCompany(created)
      setQuickCreateOpen(null)
    } catch (err: unknown) {
      console.error("Failed to quick-create company", err)
    } finally {
      setQuickCreateLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        title,
        value: amount ? Number(amount) : undefined,
        currency,
        stage: stage || undefined,
        notes: notes || undefined,
      }
      if (expectedCloseDate) {
        // Noon UTC avoids CLP (UTC-4/-3) day-shift when the backend treats
        // the date as UTC midnight.
        payload.expected_close_date = `${expectedCloseDate}T12:00:00Z`
      }
      if (selectedContact) {
        payload.contact_id = selectedContact.id
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
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t("deals.editDeal") : t("deals.newDeal")} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="slds-label" htmlFor="title">
            {t("deals.dealName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            className="slds-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="amount">{t("deals.amount")}</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              className="slds-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="slds-label" htmlFor="currency">{t("deals.currency")}</label>
            <select
              id="currency"
              className="slds-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="slds-label" htmlFor="stage">{t("deals.stage")}</label>
            <select
              id="stage"
              className="slds-input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">{t("deals.selectStage")}</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="slds-label" htmlFor="expectedCloseDate">{t("deals.expectedCloseDate")}</label>
            <input
              id="expectedCloseDate"
              type="date"
              className="slds-input"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="slds-label">{t("deals.contact")}</label>
          <SearchDropdown<Contact>
            value={contactSearch}
            onChange={handleContactInputChange}
            results={contactResults}
            onSelect={selectContact}
            selected={selectedContact}
            onClear={clearContact}
            dropdownOpen={contactDropdownOpen}
            placeholder={t("deals.searchContacts")}
            renderItem={(contact) => (
              <>
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{contact.first_name} {contact.last_name}</span>
              </>
            )}
            wrapperRef={contactRef}
            footerAction={{ label: t("deals.createNewContact"), icon: Plus, onClick: () => { setContactDropdownOpen(false); setQuickCreateOpen("contact") } }}
          />
          {quickCreateOpen === "contact" && (
            <div className="mt-2 p-3.5 border border-border rounded-[10px] bg-muted/50 space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("deals.quickCreateContact")}</p>
              <div
                ref={quickContactFormRef}
                className="space-y-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !quickCreateLoading) {
                    handleQuickCreateContact(e)
                  }
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <input name="first_name" placeholder={t("deals.firstName")} required className="slds-input text-sm" />
                  <input name="last_name" placeholder={t("deals.lastName")} required className="slds-input text-sm" />
                </div>
                <input name="email" type="email" placeholder={t("deals.email")} className="slds-input text-sm" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setQuickCreateOpen(null)} className="slds-btn slds-btn--neutral text-xs">{t("deals.cancel")}</button>
                  <button type="button" disabled={quickCreateLoading} onClick={(e) => handleQuickCreateContact(e)} className="slds-btn slds-btn--brand text-xs flex items-center gap-1">
                    {quickCreateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {t("deals.create")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="slds-label">{t("deals.company")}</label>
          <SearchDropdown<Company>
            value={companySearch}
            onChange={handleCompanyInputChange}
            results={companyResults}
            onSelect={selectCompany}
            selected={selectedCompany}
            onClear={clearCompany}
            dropdownOpen={companyDropdownOpen}
            placeholder={t("deals.searchCompanies")}
            renderItem={(company) => (
              <>
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{company.name}</span>
              </>
            )}
            wrapperRef={companyRef}
            footerAction={{ label: t("deals.createNewCompany"), icon: Plus, onClick: () => { setCompanyDropdownOpen(false); setQuickCreateOpen("company") } }}
          />
          {quickCreateOpen === "company" && (
            <div className="mt-2 p-3.5 border border-border rounded-[10px] bg-muted/50 space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("deals.quickCreateCompany")}</p>
              <div
                ref={quickCompanyFormRef}
                className="space-y-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !quickCreateLoading) {
                    handleQuickCreateCompany(e)
                  }
                }}
              >
                <input name="name" placeholder={t("deals.companyName")} required className="slds-input text-sm" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setQuickCreateOpen(null)} className="slds-btn slds-btn--neutral text-xs">{t("deals.cancel")}</button>
                  <button type="button" disabled={quickCreateLoading} onClick={(e) => handleQuickCreateCompany(e)} className="slds-btn slds-btn--brand text-xs flex items-center gap-1">
                    {quickCreateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {t("deals.create")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="slds-label" htmlFor="notes">{t("deals.notes")}</label>
          <textarea
            id="notes"
            className="slds-input min-h-[80px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="slds-modal__footer">
          <button type="button" onClick={onClose} className="slds-btn slds-btn--neutral">
            {t("deals.cancel")}
          </button>
          <button type="submit" disabled={loading} className="slds-btn slds-btn--brand disabled:opacity-50">
            {loading ? t("deals.saving") : initialData ? t("deals.updateDeal") : t("deals.createDeal")}
          </button>
        </div>
      </form>
    </Modal>
  )
}
