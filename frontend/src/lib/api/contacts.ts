import { request, downloadFile } from "../api-client";
import type { Contact, Deal, Activity, PaginatedResponse } from "../types";

export const contactsApi = {
  list: (
    params?: {
      page?: number;
      per_page?: number;
      search?: string;
      sort_by?: string;
      sort_order?: string;
      company?: string;
      position?: string;
      created_after?: string;
      created_before?: string;
    },
    signal?: AbortSignal
  ) => request<PaginatedResponse<Contact>>("/api/v1/contacts", { params, signal }),

  get: (id: string) => request<Contact>(`/api/v1/contacts/${id}`),

  create: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_id?: string;
    position?: string;
    notes?: string;
  }) =>
    request<Contact>("/api/v1/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/api/v1/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/contacts/${id}`, { method: "DELETE" }),

  exportCsv: (params?: { search?: string }) =>
    downloadFile(`/api/v1/contacts/export`, params),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/contacts/import", {
      method: "POST",
      // text/csv (not JSON): the backend reads the raw body as bytes.
      headers: { "Content-Type": "text/csv;charset=utf-8" },
      body,
    }),

  bulkDelete: (ids: string[]) =>
    request<{ deleted: number }>("/api/v1/contacts/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getDeals: (id: string) => request<Deal[]>(`/api/v1/contacts/${id}/deals`),
  getActivities: (id: string) => request<Activity[]>(`/api/v1/contacts/${id}/activities`),
};
