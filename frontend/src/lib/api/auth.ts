import { request } from "../api-client";
import type { AuthResponse, User } from "../types";

export const authApi = {
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) =>
    request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<void>("/api/v1/auth/logout", { method: "POST" }),

  refresh: (data: { refresh_token: string }) =>
    request<AuthResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<User>("/api/v1/auth/me"),

  updateProfile: (data: Partial<User>) =>
    request<User>("/api/v1/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changePassword: (data: {
    current_password: string;
    new_password: string;
  }) =>
    request<void>("/api/v1/auth/password", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    request<void>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<void>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};
