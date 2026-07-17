import { request } from "../api-client";
import type { Lead, LeadActivity, LeadStats, PaginatedResponse } from "../types";

export const leadsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    lead_source?: string;
    sort?: string;
    sort_dir?: string;
  }) => request<PaginatedResponse<Lead>>("/api/v1/leads", { params }),

  get: (id: string) => request<Lead>(`/api/v1/leads/${id}`),

  create: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    title?: string;
    industry?: string;
    website?: string;
    lead_source?: string;
    assigned_to?: string;
    notes?: string;
  }) =>
    request<Lead>("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Lead>) =>
    request<Lead>(`/api/v1/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/leads/${id}`, { method: "DELETE" }),

  convert: (id: string, data: {
    pipeline_id: string;
    deal_title?: string;
    deal_value?: number;
  }) =>
    request<{ contact_id?: string; company_id?: string; deal_id?: string }>(
      `/api/v1/leads/${id}/convert`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  stats: () => request<LeadStats>("/api/v1/leads/stats"),

  getActivities: (id: string) =>
    request<LeadActivity[]>(`/api/v1/leads/${id}/activities`),

  createActivity: (id: string, data: {
    type: string;
    subject: string;
    description?: string;
    due_date?: string;
  }) =>
    request<LeadActivity>(`/api/v1/leads/${id}/activities`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeActivity: (leadId: string, activityId: string) =>
    request<void>(`/api/v1/leads/${leadId}/activities/${activityId}`, {
      method: "POST",
    }),

  deleteActivity: (leadId: string, activityId: string) =>
    request<void>(`/api/v1/leads/${leadId}/activities/${activityId}`, {
      method: "DELETE",
    }),
};
