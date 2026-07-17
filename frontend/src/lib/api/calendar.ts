import { request } from "../api-client";
import type { CalendarEvent } from "../types";

export const calendarApi = {
  status: () => request<{ google: boolean; microsoft: boolean }>("/api/v1/calendar/status"),

  listEvents: (params?: {
    start?: string;
    end?: string;
    provider?: string;
  }) => request<CalendarEvent[]>("/api/v1/calendar/events", { params }),

  createEvent: (data: {
    title: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time: string;
    all_day?: boolean;
    attendees?: string[];
    entity_type?: string;
    entity_id?: string;
  }) =>
    request<CalendarEvent>("/api/v1/calendar/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: Partial<CalendarEvent>) =>
    request<CalendarEvent>(`/api/v1/calendar/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    request<void>(`/api/v1/calendar/events/${id}`, { method: "DELETE" }),

  getAuthUrl: (provider: string) =>
    request<{ url: string }>(`/api/v1/calendar/auth/${provider}`),

  syncGoogle: () =>
    request<{ synced: number }>("/api/v1/calendar/sync/google", { method: "POST" }),
};
