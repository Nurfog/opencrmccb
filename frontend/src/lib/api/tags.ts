import { request } from "../api-client";
import type { Tag } from "../types";

export const tagsApi = {
  list: () =>
    request<Tag[]>("/api/v1/tags"),

  create: (data: { name: string; color?: string }) =>
    request<Tag>("/api/v1/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Tag>) =>
    request<Tag>(`/api/v1/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/tags/${id}`, { method: "DELETE" }),

  assign: (tagId: string, entityType: string, entityId: string) =>
    request<void>("/api/v1/tags/assign", {
      method: "POST",
      body: JSON.stringify({ tag_id: tagId, entity_type: entityType, entity_id: entityId }),
    }),

  remove: (tagId: string, entityType: string, entityId: string) =>
    request<void>(`/api/v1/tags/${tagId}/${entityType}/${entityId}`, {
      method: "DELETE",
    }),

  getForEntity: (entityType: string, entityId: string) =>
    request<Tag[]>(`/api/v1/tags/${entityType}/${entityId}`),
};
