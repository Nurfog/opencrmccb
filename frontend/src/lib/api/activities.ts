import { request } from "../api-client";
import type { Activity } from "../types";

export const activitiesApi = {
  list: () =>
    request<Activity[]>("/api/v1/activities"),

  get: (id: string) =>
    request<Activity>(`/api/v1/activities/${id}`),

  create: (data: {
    activity_type: string;
    subject: string;
    description?: string;
    contact_id?: string;
    deal_id?: string;
    company_id?: string;
    due_date?: string;
  }) =>
    request<Activity>("/api/v1/activities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Activity>) =>
    request<Activity>(`/api/v1/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/activities/${id}`, { method: "DELETE" }),

  complete: (id: string) =>
    request<Activity>(`/api/v1/activities/${id}/complete`, { method: "POST" }),
};
