export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Token state: stored in memory for Authorization header fallback.
// The backend also sets httpOnly cookies (access_token, refresh_token, csrf_token).
let accessToken: string | null = null;
let refreshToken: string | null = null;
let csrfToken: string | null = null;
let onLogout: (() => void) | null = null;

if (typeof window !== "undefined") {
  const cookies = document.cookie.split(";").reduce((acc, c) => {
    const [key, val] = c.trim().split("=");
    if (key) acc[key] = val ?? "";
    return acc;
  }, {} as Record<string, string>);
  csrfToken = cookies["csrf_token"] ?? null;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCsrfToken(): string | null {
  if (csrfToken) return csrfToken;
  if (typeof window !== "undefined") {
    const cookies = document.cookie.split(";").reduce((acc, c) => {
      const [key, val] = c.trim().split("=");
      if (key) acc[key] = val ?? "";
      return acc;
    }, {} as Record<string, string>);
    csrfToken = cookies["csrf_token"] ?? null;
  }
  return csrfToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  csrfToken = null;
}

export function setLogoutHandler(handler: () => void): void {
  onLogout = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        clearTokens();
        onLogout?.();
        return null;
      }
      const data = await res.json();
      accessToken = data.access_token ?? data.access;
      const newRefresh = data.refresh_token ?? data.refresh;
      if (newRefresh) {
        refreshToken = newRefresh;
      }
      if (typeof window !== "undefined") {
        const cookies = document.cookie.split(";").reduce((acc, c) => {
          const [key, val] = c.trim().split("=");
          if (key) acc[key] = val ?? "";
          return acc;
        }, {} as Record<string, string>);
        csrfToken = cookies["csrf_token"] ?? null;
      }
      return accessToken;
    } catch {
      clearTokens();
      onLogout?.();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit & RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;
  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const bodyIsFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!bodyIsFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Add CSRF token for state-changing requests
  const method = (fetchOptions.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  let res = await fetch(url, { ...fetchOptions, headers, credentials: "include" });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      // Re-read CSRF token after refresh
      const csrf = getCsrfToken();
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
      res = await fetch(url, { ...fetchOptions, headers, credentials: "include" });
    }
  }

  if (!res.ok) {
    let errorData: unknown;
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }
    const message =
      (errorData as Record<string, unknown>)?.message as string ??
      (errorData as Record<string, unknown>)?.detail as string ??
      res.statusText;
    throw new ApiError(message, res.status, errorData);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export async function downloadFile(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<Blob | null> {
  let token = accessToken;
  if (!token) {
    token = await refreshAccessToken();
    if (!token) return null;
  }

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) return null;
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!retry.ok) return null;
    return retry.blob();
  }

  if (!res.ok) return null;
  return res.blob();
}
