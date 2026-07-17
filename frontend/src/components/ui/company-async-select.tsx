"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Search, Building2, Plus } from "lucide-react"
import { companiesApi, type Company } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import { cn } from "@/lib/utils"

interface CompanyAsyncSelectProps {
  value?: Company | null
  onChange: (company: Company | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
}

export function CompanyAsyncSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
}: CompanyAsyncSelectProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState(value?.name ?? "")
  const [results, setResults] = useState<Company[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value) {
      setSearch(value.name)
    } else if (!dropdownOpen) {
      setSearch("")
    }
  }, [value, dropdownOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setIsCreating(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchCompanies = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }
    try {
      const res = await companiesApi.list({ search: query })
      setResults(res.data)
    } catch {
      setResults([])
    }
  }, [])

  const handleInputChange = (value: string) => {
    setSearch(value)
    onChange(null)
    setDropdownOpen(true)
    setIsCreating(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCompanies(value), 300)
  }

  const selectCompany = (company: Company) => {
    onChange(company)
    setSearch(company.name)
    setDropdownOpen(false)
    setIsCreating(false)
  }

  const clearSelection = () => {
    onChange(null)
    setSearch("")
    setResults([])
  }

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return
    try {
      const created = await companiesApi.create({ name: newCompanyName.trim() })
      onChange(created)
      setSearch(created.name)
      setDropdownOpen(false)
      setIsCreating(false)
      setNewCompanyName("")
    } catch {
      // Creation failed — keep dropdown open
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="slds-label">{t("contacts.company")}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className={cn("slds-input pl-10", error && "border-red-500")}
          value={search}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setDropdownOpen(true)
          }}
          placeholder={placeholder ?? t("companies.searchCompanies")}
          disabled={disabled}
        />
        {search && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {dropdownOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isCreating ? (
            <div className="p-2">
              <input
                className="slds-input text-sm"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder={t("contacts.companyName") ?? "Company name"}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateCompany()
                  }
                  if (e.key === "Escape") {
                    setIsCreating(false)
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="slds-btn text-xs flex-1"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleCreateCompany}
                  className="slds-btn slds-btn--brand text-xs flex-1"
                >
                  {t("common.create")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {results.length > 0 && (
                <div>
                  {results.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => selectCompany(company)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                    >
                      <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span>{company.name}</span>
                      {company.industry && (
                        <span className="text-xs text-muted-foreground ml-auto">{company.industry}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewCompanyName(search)
                  setIsCreating(true)
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-brand hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-t border-gray-200 dark:border-gray-700"
              >
                <Plus className="h-4 w-4" />
                <span>{t("admin.newCompany") ?? "Create new company"}</span>
              </button>
              {results.length === 0 && search.trim() && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {t("common.noResults")}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
