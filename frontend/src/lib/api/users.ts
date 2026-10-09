import { request } from "../api-client";
import type { PaginatedResponse, User } from "../types";

export const usersApi = {
  list: () => request<PaginatedResponse<User>>("/api/v1/users"),

  delete: (id: string) =>
    request<void>(`/api/v1/users/${id}`, { method: "DELETE" }),

  updateProfile: (id: string, profileId: string) =>
    request<User>(`/api/v1/users/${id}/profile`, {
      method: "PUT",
      body: JSON.stringify({ profile_id: profileId }),
    }),
};
