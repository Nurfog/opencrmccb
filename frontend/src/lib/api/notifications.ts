import { request } from "../api-client";
import type { Notification, NotificationPreferences } from "../types";

export const notificationsApi = {
  list: () =>
    request<Notification[]>("/api/v1/notifications"),

  getUnreadCount: () =>
    request<{ count: number }>("/api/v1/notifications/unread-count"),

  markAsRead: (id: string) =>
    request<void>(`/api/v1/notifications/${id}/read`, { method: "PUT" }),

  markAllAsRead: () =>
    request<void>("/api/v1/notifications/read-all", { method: "PUT" }),

  delete: (id: string) =>
    request<void>(`/api/v1/notifications/${id}`, { method: "DELETE" }),

  getPreferences: () =>
    request<NotificationPreferences>("/api/v1/notifications/preferences"),

  updatePreferences: (data: Partial<NotificationPreferences>) =>
    request<void>("/api/v1/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
