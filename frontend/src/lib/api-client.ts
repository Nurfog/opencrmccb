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
// Auth is cookie-first; the in-memory access token is only a fallback for
// Authorization header. Refresh goes via httpOnly cookie (credentials:include).
let accessToken: string | null = null;
let csrfToken: string | null = null;
let onLogout: (() => void) | null = null;

function parseCookies(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return document.cookie.split(";").reduce((acc, c) => {
    const idx = c.indexOf("=");
    if (idx === -1) return acc;
    const key = c.slice(0, idx).trim();
    const val = decodeURIComponent(c.slice(idx + 1).trim());
    if (key) acc[key] = val;
    return acc;
  }, {} as Record<string, string>);
}

if (typeof window !== "undefined") {
  csrfToken = parseCookies()["csrf_token"] ?? null;
}

export function setTokens(access: string, _refresh?: string): void {
  // `_refresh` kept for backwards compat; refresh travels via httpOnly cookie.
  accessToken = access;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCsrfToken(): string | null {
  if (csrfToken) return csrfToken;
  if (typeof window !== "undefined") {
    csrfToken = parseCookies()["csrf_token"] ?? null;
  }
  return csrfToken;
}

export function clearTokens(): void {
  accessToken = null;
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
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        clearTokens();
        onLogout?.();
        return null;
      }
      const data = await res.json();
      accessToken = data.access_token ?? data.access ?? null;
      if (typeof window !== "undefined") {
        csrfToken = parseCookies()["csrf_token"] ?? null;
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

  const bodyIsFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const hasBody = options.body !== undefined && options.body !== null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  // Only force JSON when there is a body (avoids useless CORS preflights on GET).
  if (hasBody && !bodyIsFormData && !headers["Content-Type"]) {
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
    const errObj = errorData as Record<string, unknown>;
    const message =
      (errObj?.error as string) ??
      (errObj?.message as string) ??
      (errObj?.detail as string) ??
      res.statusText;
    throw new ApiError(message, res.status, errorData);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export async function downloadFile(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<Blob> {
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

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    return fetch(url, { headers, credentials: "include" });
  };

  let res = await doFetch();

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken && !accessToken) {
      throw new ApiError("Unauthorized", 401, null);
    }
    res = await doFetch();
  }

  if (!res.ok) {
    let errorData: unknown = null;
    try {
      errorData = await res.clone().json();
    } catch {
      // binary error body — keep null
    }
    const msg =
      (errorData as Record<string, unknown> | null)?.error as string ??
      (errorData as Record<string, unknown> | null)?.message as string ??
      res.statusText;
    throw new ApiError(msg, res.status, errorData);
  }
  return res.blob();
}
