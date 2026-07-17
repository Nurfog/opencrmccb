import { request } from "../api-client";
import type { Webhook, WebhookDelivery } from "../types";

export const webhooksApi = {
  list: () => request<Webhook[]>("/api/v1/webhooks"),

  create: (data: { url: string; event: string; secret?: string }) =>
    request<Webhook>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { url?: string; active?: boolean; secret?: string }) =>
    request<Webhook>(`/api/v1/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/webhooks/${id}`, { method: "DELETE" }),

  listDeliveries: (id: string) =>
    request<WebhookDelivery[]>(`/api/v1/webhooks/${id}/deliveries`),
};
