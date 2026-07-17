import { request } from "../api-client";
import type { AIConfig, LeadExtraction } from "../types";

export const aiApi = {
  getConfig: () =>
    request<AIConfig>("/api/v1/settings/ai"),

  updateConfig: (data: { provider?: string; api_url?: string; api_key?: string; model?: string }) =>
    request<AIConfig>("/api/v1/settings/ai", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  extractLead: (phone_number: string) =>
    request<LeadExtraction>("/api/v1/leads/extract", {
      method: "POST",
      body: JSON.stringify({ phone_number }),
    }),

  getExtractions: (phone_number?: string) =>
    request<LeadExtraction[]>(`/api/v1/leads/extractions${phone_number ? `?phone_number=${phone_number}` : ""}`),
};
