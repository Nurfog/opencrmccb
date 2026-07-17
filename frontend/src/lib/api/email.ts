import { request } from "../api-client";
import type { EmailLog, EmailTemplate, PaginatedResponse } from "../types";

export const emailApi = {
  send: (data: {
    from?: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    body_html?: string;
    entity_type?: string;
    entity_id?: string;
    template_id?: string;
  }) =>
    request<EmailLog>("/api/v1/email/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listLogs: (params?: { page?: number; per_page?: number }) =>
    request<PaginatedResponse<EmailLog>>("/api/v1/email/logs", { params }),

  getLog: (id: string) => request<EmailLog>(`/api/v1/email/logs/${id}`),

  listTemplates: () => request<EmailTemplate[]>("/api/v1/email/templates"),

  createTemplate: (data: {
    name: string;
    subject: string;
    body: string;
    body_html?: string;
    category?: string;
  }) =>
    request<EmailTemplate>("/api/v1/email/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: Partial<EmailTemplate>) =>
    request<EmailTemplate>(`/api/v1/email/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request<void>(`/api/v1/email/templates/${id}`, { method: "DELETE" }),

  sendFromTemplate: (templateId: string, data: {
    to: string;
    from?: string;
    entity_type?: string;
    entity_id?: string;
  }) =>
    request<EmailLog>(`/api/v1/email/send-from-template/${templateId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
