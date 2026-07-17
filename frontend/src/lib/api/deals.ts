import { request } from "../api-client";
import type { Deal, Activity, PaginatedResponse } from "../types";

export const dealsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    stage?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<PaginatedResponse<Deal>>("/api/v1/deals", { params }),

  get: (id: string) => request<Deal>(`/api/v1/deals/${id}`),

  create: (data: {
    title: string;
    value: number;
    currency?: string;
    stage?: string;
    contact_id?: string;
    company_id?: string;
    expected_close_date?: string;
    notes?: string;
  }) =>
    request<Deal>("/api/v1/deals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Deal>) =>
    request<Deal>(`/api/v1/deals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/deals/${id}`, { method: "DELETE" }),

  updateStage: (id: string, data: { stage: string; position?: number }) =>
    request<Deal>(`/api/v1/deals/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  exportCsv: (params?: { search?: string }) =>
    request<string>(`/api/v1/deals/export`, { params }),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/deals/import", {
      method: "POST",
      body,
    }),

  getActivities: (id: string) => request<Activity[]>(`/api/v1/deals/${id}/activities`),
};
