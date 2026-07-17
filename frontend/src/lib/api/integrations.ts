import { request } from "../api-client";
import type { IntegrationStatus } from "../types";

export const integrationsApi = {
  list: () =>
    request<IntegrationStatus[]>("/api/v1/integrations"),

  connect: (provider: string) =>
    request<{ auth_url: string }>(`/api/v1/integrations/${provider}/connect`),

  disconnect: (provider: string) =>
    request<void>(`/api/v1/integrations/${provider}/disconnect`, { method: "DELETE" }),
};
