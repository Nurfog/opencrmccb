"use client"

import { useState } from "react"
import { X, Filter, Calendar, DollarSign, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

export interface FilterField {
  key: string
  label: string
  type: "text" | "date" | "date_range" | "select" | "number_range"
  options?: { value: string; label: string }[]
}

interface AdvancedFiltersProps {
  fields: FilterField[]
  values: Record<string, string | [string, string] | undefined>
  onChange: (values: Record<string, string | [string, string] | undefined>) => void
  onClear: () => void
}

export function AdvancedFilters({ fields, values, onChange, onClear }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()

  const activeCount = Object.values(values).filter((v) => {
    if (Array.isArray(v)) return v[0] || v[1]
    return v
  }).length

  const updateFilter = (key: string, value: string | [string, string] | undefined) => {
    onChange({ ...values, [key]: value })
  }

  const clearAll = () => {
    onClear()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "slds-btn slds-btn--neutral flex items-center gap-2",
          activeCount > 0 && "border-brand text-brand"
        )}
      >
        <Filter className="h-4 w-4" />
        {t("common.filters")}
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-brand text-white">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t("common.filters")}</h3>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-brand hover:underline"
                >
                  {t("common.clearAll")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-auto">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {field.label}
                </label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={(values[field.key] as string) || ""}
                    onChange={(e) => updateFilter(field.key, e.target.value || undefined)}
                    className="slds-input text-sm"
                    placeholder={`${field.label.toLowerCase()}...`}
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={(values[field.key] as string) || ""}
                    onChange={(e) => updateFilter(field.key, e.target.value || undefined)}
                    className="slds-input text-sm"
                  >
                    <option value="">{t("common.all")}</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "date_range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={(Array.isArray(values[field.key]) ? values[field.key]?.[0] : "") || ""}
                      onChange={(e) => {
                        const current = Array.isArray(values[field.key]) ? values[field.key] : ["", ""]
                        updateFilter(field.key, [e.target.value, current?.[1] || ""])
                      }}
                      className="slds-input text-sm flex-1"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="date"
                      value={(Array.isArray(values[field.key]) ? values[field.key]?.[1] : "") || ""}
                      onChange={(e) => {
                        const current = Array.isArray(values[field.key]) ? values[field.key] : ["", ""]
                        updateFilter(field.key, [current?.[0] || "", e.target.value])
                      }}
                      className="slds-input text-sm flex-1"
                    />
                  </div>
                )}

                {field.type === "number_range" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={(Array.isArray(values[field.key]) ? values[field.key]?.[0] : "") || ""}
                      onChange={(e) => {
                        const current = Array.isArray(values[field.key]) ? values[field.key] : ["", ""]
                        updateFilter(field.key, [e.target.value, current?.[1] || ""])
                      }}
                      className="slds-input text-sm flex-1"
                      placeholder="Min"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      value={(Array.isArray(values[field.key]) ? values[field.key]?.[1] : "") || ""}
                      onChange={(e) => {
                        const current = Array.isArray(values[field.key]) ? values[field.key] : ["", ""]
                        updateFilter(field.key, [current?.[0] || "", e.target.value])
                      }}
                      className="slds-input text-sm flex-1"
                      placeholder="Max"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full slds-btn slds-btn--brand"
            >
              {t("common.filters")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ActiveFiltersProps {
  values: Record<string, string | [string, string] | undefined>
  fields: FilterField[]
  onChange: (values: Record<string, string | [string, string] | undefined>) => void
}

export function ActiveFilters({ values, fields, onChange }: ActiveFiltersProps) {
  const { t } = useI18n()

  const activeFilters = Object.entries(values)
    .filter(([, v]) => {
      if (Array.isArray(v)) return v[0] || v[1]
      return v
    })
    .map(([key, value]) => {
      const field = fields.find((f) => f.key === key)
      if (!field) return null

      let displayValue: string
      if (Array.isArray(value)) {
        displayValue = value.filter(Boolean).join(" - ")
      } else {
        displayValue = value || ""
      }

      return { key, label: field.label, value: displayValue }
    })
    .filter(Boolean) as { key: string; label: string; value: string }[]

  if (activeFilters.length === 0) return null

  const removeFilter = (key: string) => {
    const newValues = { ...values }
    delete newValues[key]
    onChange(newValues)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500">{t("common.active")}:</span>
      {activeFilters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-brand/10 text-brand"
        >
          {filter.label}: {filter.value}
          <button
            type="button"
            onClick={() => removeFilter(filter.key)}
            className="hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
