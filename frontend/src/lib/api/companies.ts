import { request } from "../api-client";
import type { Company, Contact, Deal, PaginatedResponse } from "../types";

export const companiesApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<PaginatedResponse<Company>>("/api/v1/companies", { params }),

  get: (id: string) => request<Company>(`/api/v1/companies/${id}`),

  create: (data: {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
  }) =>
    request<Company>("/api/v1/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Company>) =>
    request<Company>(`/api/v1/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/companies/${id}`, { method: "DELETE" }),

  exportCsv: (params?: { search?: string }) =>
    request<string>(`/api/v1/companies/export`, { params }),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/companies/import", {
      method: "POST",
      body,
    }),

  getContacts: (id: string) => request<Contact[]>(`/api/v1/companies/${id}/contacts`),
  getDeals: (id: string) => request<Deal[]>(`/api/v1/companies/${id}/deals`),
  getRevenue: (id: string) => request<{ total_value: number; deal_count: number }>(`/api/v1/companies/${id}/revenue`),
};
