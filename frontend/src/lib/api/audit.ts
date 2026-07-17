import { request } from "../api-client";
import type { AuditEvent } from "../types";

export const auditApi = {
  list: (params?: {
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    page?: number;
    per_page?: number;
  }) => request<AuditEvent[]>("/api/v1/audit", { params }),

  entityHistory: (entityType: string, entityId: string) =>
    request<AuditEvent[]>(`/api/v1/audit/entity/${entityType}/${entityId}`),
};
