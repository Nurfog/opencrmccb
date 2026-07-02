"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Search, ChevronUp, ChevronDown, Edit, Trash2, Filter, X, Building2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { companiesApi, type Company, type PaginatedResponse } from "@/lib/api"
import { CompanyForm } from "@/components/forms/company-form"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDate, cn } from "@/lib/utils"

export default function CompaniesPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [data, setData] = useState<PaginatedResponse<Company> | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const perPage = 25

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const res = await companiesApi.list({ page, per_page: perPage, search: search || undefined })
      setData(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [page, search, t])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

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

  const openCreate = () => {
    setEditingCompany(null)
    setFormOpen(true)
  }

  const openEdit = (company: Company) => {
    setEditingCompany(company)
    setFormOpen(true)
  }

  const openDelete = (company: Company) => {
    setDeleteTarget(company)
    setDeleteOpen(true)
  }

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    try {
      if (editingCompany) {
        await companiesApi.update(editingCompany.id, formData as Partial<Company>)
        success(t("toast.updated", { entity: t("companies.title") }))
      } else {
        await companiesApi.create(formData as Parameters<typeof companiesApi.create>[0])
        success(t("toast.created", { entity: t("companies.title") }))
      }
      setFormOpen(false)
      setEditingCompany(null)
      fetchCompanies()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: editingCompany ? "update" : "create", entity: t("companies.title") })
      error(msg)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await companiesApi.delete(deleteTarget.id)
      success(t("toast.deleted", { entity: t("companies.title") }))
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchCompanies()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("companies.title") })
      error(msg)
    }
  }

  const totalPages = data ? data.total_pages : 0

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("companies.title")}</h1>
            <p className="slds-header__description">{t("companies.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openCreate} className="slds-btn slds-btn--brand flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("companies.newCompany")}
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
                placeholder={t("companies.searchCompanies")}
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : errorState ? (
          <EmptyState
            icon={Building2}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchCompanies }}
          />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("companies.noCompanies")}
            description={t("companies.noCompaniesDescription")}
            action={{ label: t("companies.newCompany"), onClick: openCreate }}
          />
        ) : (
          <>
            <div className="slds-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="slds-table">
                  <thead>
                    <tr>
                      <th>{t("companies.companyName")}</th>
                      <th>{t("companies.industry")}</th>
                      <th>{t("companies.city")}</th>
                      <th>{t("companies.country")}</th>
                      <th className="w-24">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((company) => (
                      <tr key={company.id}>
                        <td className="font-medium"><a href={`/companies/${company.id}`} className="hover:underline">{company.name}</a></td>
                        <td className="text-sm">{company.industry ?? "-"}</td>
                        <td className="text-sm">{company.city ?? "-"}</td>
                        <td className="text-sm">{company.country ?? "-"}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openEdit(company)} className="slds-btn slds-btn--icon">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openDelete(company)} className="slds-btn slds-btn--icon text-red-500 hover:text-red-700 dark:hover:text-red-400">
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

      <CompanyForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingCompany(null) }}
        onSubmit={handleFormSubmit}
        initialData={editingCompany ?? undefined}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={t("companies.deleteCompany")}
        message={deleteTarget ? t("companies.deleteCompanyMessage", { name: deleteTarget.name }) : ""}
        confirmLabel={t("common.yesDelete")}
        variant="danger"
      />
    </AppLayout>
  )
}
