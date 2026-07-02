"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, Building2, TrendingUp, ArrowRight } from "lucide-react"
import { searchApi, type SearchResult } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

interface GlobalSearchProps {
  className?: string
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ contacts: SearchResult[]; companies: SearchResult[]; deals: SearchResult[] } | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults(null)
        return
      }

      setLoading(true)
      try {
        const data = await searchApi.search({ q: query.trim() })
        setResults(data)
        setIsOpen(true)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleSelect = (type: string, id: string) => {
    setIsOpen(false)
    setQuery("")
    router.push(`/${type}s/${id}`)
  }

  const handleShowAll = () => {
    setIsOpen(false)
    router.push(`/contacts?search=${encodeURIComponent(query)}`)
    setQuery("")
  }

  const totalResults = results
    ? results.contacts.length + results.companies.length + results.deals.length
    : 0

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) handleShowAll()
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          placeholder={t("search.placeholder")}
          className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-white/40 focus:bg-white/15 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/50 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </form>

      {isOpen && results && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-auto">
          {totalResults === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              {t("search.noResults", { query })}
            </div>
          ) : (
            <>
              {/* Contacts */}
              {results.contacts.length > 0 && (
                <div className="border-b border-gray-100 dark:border-gray-800">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {t("nav.contacts")}
                  </div>
                  {results.contacts.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("contact", result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Companies */}
              {results.companies.length > 0 && (
                <div className="border-b border-gray-100 dark:border-gray-800">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {t("nav.companies")}
                  </div>
                  {results.companies.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("company", result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Deals */}
              {results.deals.length > 0 && (
                <div className="border-b border-gray-100 dark:border-gray-800">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    {t("nav.deals")}
                  </div>
                  {results.deals.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("deal", result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Show all results */}
              <button
                type="button"
                onClick={handleShowAll}
                className="w-full px-3 py-2 text-left text-sm text-brand hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                {t("search.showAll", { count: String(totalResults) })}
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
