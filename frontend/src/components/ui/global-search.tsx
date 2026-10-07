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
  const abortRef = useRef<AbortController | null>(null)

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
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const searchTimeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults(null)
        return
      }

      setLoading(true)
      try {
        const data = await searchApi.search({ q: query.trim() }, controller.signal)
        if (!controller.signal.aborted) {
          setResults(data)
          setIsOpen(true)
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        if (!controller.signal.aborted) setResults(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(searchTimeout)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          placeholder={t("search.placeholder")}
          className="w-full bg-muted/60 border border-input rounded-lg pl-10 pr-12 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-input bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </form>

      {isOpen && results && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-pop z-50 max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground" aria-busy="true">
              {t("app.loading")}
            </div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {t("search.noResults", { query })}
            </div>
          ) : (
            <>
              {/* Contacts */}
              {results.contacts.length > 0 && (
                <div className="border-b border-border/70">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {t("nav.contacts")}
                  </div>
                  {results.contacts.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("contact", result.id)}
                      className="w-[calc(100%-8px)] px-3 py-2 mx-1 text-left hover:bg-muted flex items-center gap-3 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* Companies */}
              {results.companies.length > 0 && (
                <div className="border-b border-border/70">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {t("nav.companies")}
                  </div>
                  {results.companies.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("company", result.id)}
                      className="w-[calc(100%-8px)] px-3 py-2 mx-1 text-left hover:bg-muted flex items-center gap-3 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* Deals */}
              {results.deals.length > 0 && (
                <div className="border-b border-border/70">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    {t("nav.deals")}
                  </div>
                  {results.deals.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect("deal", result.id)}
                      className="w-[calc(100%-8px)] px-3 py-2 mx-1 text-left hover:bg-muted flex items-center gap-3 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-medium">
                        {result.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* Show all results */}
              <button
                type="button"
                onClick={handleShowAll}
                className="w-[calc(100%-8px)] px-3 py-2 mx-1 text-left text-sm text-brand hover:bg-muted flex items-center justify-center gap-2 rounded-lg"
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
