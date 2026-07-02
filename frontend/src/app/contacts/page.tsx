"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, Download, ChevronUp, ChevronDown, Edit, Trash2, FileText, Filter, X, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { contactsApi, type Contact, type PaginatedResponse } from "@/lib/api"
import { ContactForm } from "@/components/forms/contact-form"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AdvancedFilters, ActiveFilters, type FilterField } from "@/components/ui/advanced-filters"
import { exportContactsToPdf } from "@/lib/pdf"
import { formatDate, getInitials, cn } from "@/lib/utils"

type SortField = "first_name" | "last_name" | "email" | "phone" | "position"
type SortDir = "asc" | "desc"

export default function ContactsPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [data, setData] = useState<PaginatedResponse<Contact> | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [sortField, setSortField] = useState<SortField>("first_name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, string | [string, string] | undefined>>({})
  const [bulkLoading, setBulkLoading] = useState(false)

  const perPage = 25

  const filterFields: FilterField[] = [
    { key: "company", label: "Company", type: "text" },
    { key: "position", label: "Position", type: "text" },
    { key: "created_after", label: "Created After", type: "date_range" },
  ]

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await contactsApi.list({
        page,
        per_page: perPage,
        search: search || undefined,
        sort_by: sortField,
        sort_order: sortDir,
      })
      setData(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [page, search, sortField, sortDir, t])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selectedIds.size === data.data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.data.map((c) => c.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const openCreate = () => {
    setEditingContact(null)
    setFormOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditingContact(contact)
    setFormOpen(true)
  }

  const openDelete = (contact: Contact) => {
    setDeleteTarget(contact)
    setDeleteOpen(true)
  }

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    try {
      if (editingContact) {
        await contactsApi.update(editingContact.id, formData as Partial<Contact>)
        success(t("toast.updated", { entity: t("contacts.title") }))
      } else {
        await contactsApi.create(formData as Parameters<typeof contactsApi.create>[0])
        success(t("toast.created", { entity: t("contacts.title") }))
      }
      setFormOpen(false)
      setEditingContact(null)
      fetchContacts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: editingContact ? "update" : "create", entity: t("contacts.title") })
      error(msg)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await contactsApi.delete(deleteTarget.id)
      success(t("toast.deleted", { entity: t("contacts.title") }))
      setDeleteOpen(false)
      setDeleteTarget(null)
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next })
      fetchContacts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("contacts.title") })
      error(msg)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const result = await contactsApi.bulkDelete(Array.from(selectedIds))
      success(t("toast.deleted", { entity: `${result.deleted} ${t("contacts.title")}` }))
      setSelectedIds(new Set())
      fetchContacts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("contacts.title") })
      error(msg)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleCsvExport = async () => {
    try {
      const res = await contactsApi.exportCsv()
      const blob = new Blob([res as unknown as string], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "contacts.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "export", entity: t("contacts.title") })
      error(msg)
    }
  }

  const handlePdfExport = () => {
    if (data) {
      exportContactsToPdf(data.data)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const totalPages = data ? data.total_pages : 0

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("contacts.title")}</h1>
            <p className="slds-header__description">{t("contacts.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            {data && data.data.length > 0 && (
              <>
                <button type="button" onClick={handleCsvExport} className="slds-btn slds-btn--neutral flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button type="button" onClick={handlePdfExport} className="slds-btn slds-btn--neutral flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </>
            )}
            <button type="button" onClick={openCreate} className="slds-btn slds-btn--brand flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("contacts.newContact")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="slds-input pl-10 pr-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("contacts.searchContacts")}
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
          <button type="button" onClick={() => setFilterOpen(!filterOpen)} className="slds-btn slds-btn--neutral flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t("common.filters")}
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{selectedIds.size} {t("common.selected")}</span>
              <button type="button" onClick={handleBulkDelete} disabled={bulkLoading} className="slds-btn slds-btn--neutral text-red-500 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {bulkLoading ? t("app.loading") : t("common.delete")}
              </button>
            </>
          )}
        </div>

        {filterOpen && (
          <div className="slds-card p-4">
            <AdvancedFilters
              fields={filterFields}
              values={filterValues}
              onChange={setFilterValues}
              onClear={() => { setFilterValues({}); setPage(1); fetchContacts() }}
            />
          </div>
        )}

        <ActiveFilters
          values={filterValues}
          fields={filterFields}
          onChange={(v) => { setFilterValues(v); setPage(1); }}
        />

        {loading ? (
          <TableSkeleton rows={8} />
        ) : errorState ? (
          <EmptyState
            icon={Users}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchContacts }}
          />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("contacts.noContacts")}
            description={t("contacts.noContactsDescription")}
            action={{ label: t("contacts.newContact"), onClick: openCreate }}
          />
        ) : (
          <>
            <div className="slds-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-600"
                          checked={selectedIds.size === data.data.length && data.data.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleSort("first_name")} className="flex items-center gap-1">
                          {t("contacts.name")} <SortIcon field="first_name" />
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleSort("email")} className="flex items-center gap-1">
                          {t("contacts.email")} <SortIcon field="email" />
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleSort("phone")} className="flex items-center gap-1">
                          {t("contacts.phone")} <SortIcon field="phone" />
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleSort("position")} className="flex items-center gap-1">
                          {t("contacts.position")} <SortIcon field="position" />
                        </button>
                      </th>
                      <th className="w-24">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((contact) => (
                      <tr key={contact.id} className={cn(selectedIds.has(contact.id) && "bg-blue-50 dark:bg-blue-900/20")}>
                        <td>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600"
                            checked={selectedIds.has(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                              {getInitials(`${contact.first_name} ${contact.last_name}`)}
                            </div>
                            <div>
                              <a href={`/contacts/${contact.id}`} className="text-sm font-medium hover:underline">
                                {contact.first_name} {contact.last_name}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">{contact.email ?? "-"}</td>
                        <td className="text-sm">{contact.phone ?? "-"}</td>
                        <td className="text-sm">{contact.position ?? "-"}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openEdit(contact)} className="slds-btn slds-btn--icon">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openDelete(contact)} className="slds-btn slds-btn--icon text-red-500 hover:text-red-700 dark:hover:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={data.total}
              perPage={perPage}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <ContactForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingContact(null) }}
        onSubmit={handleFormSubmit}
        initialData={editingContact ?? undefined}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={t("contacts.deleteContact")}
        message={deleteTarget ? t("contacts.deleteContactMessage", { name: `${deleteTarget.first_name} ${deleteTarget.last_name}` }) : ""}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
