const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

export type QueryValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, QueryValue>;
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

export function buildQuery(
  params?: Record<string, QueryValue>
): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === "") continue;
        searchParams.append(key, String(item));
      }
    } else {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

function combineSignal(userSignal?: AbortSignal | null): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(15000);
  if (!userSignal) return timeoutSignal;
  // `AbortSignal.any` is available in modern runtimes (Node >= 20, browsers).
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, timeoutSignal]);
  }
  return userSignal;
}

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  if (!isJsonResponse(res)) {
    return { message: res.statusText };
  }
  try {
    return await res.json();
  } catch {
    return { message: res.statusText };
  }
}

function extractErrorMessage(errorData: unknown, fallback: string): string {
  if (typeof errorData === "object" && errorData !== null) {
    const errObj = errorData as Record<string, unknown>;
    // FastAPI/Pydantic 422 shape: { detail: [{ msg, loc }] }
    if (Array.isArray(errObj.detail)) {
      const msgs = (errObj.detail as Array<Record<string, unknown>>)
        .map((d) => (typeof d.msg === "string" ? d.msg : null))
        .filter((m): m is string => !!m);
      if (msgs.length > 0) return msgs.join("; ");
    }
    if (typeof errObj.error === "string") return errObj.error;
    if (typeof errObj.message === "string") return errObj.message;
    if (typeof errObj.detail === "string") return errObj.detail;
  }
  return fallback;
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  // RFC 5987 (filename*=UTF-8''...) first, then plain filename="..."
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, "");
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() ?? null;
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
      let data: Record<string, string | null> = {};
      try {
        if ((res.headers.get("content-type") ?? "").includes("application/json")) {
          data = (await res.json()) as Record<string, string | null>;
        }
      } catch {
        data = {};
      }
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
  const { params, signal: userSignal, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${endpoint}${buildQuery(params)}`;
  const signal = combineSignal(userSignal);

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

  let res = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include",
    signal,
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      // Re-read CSRF token after refresh
      const csrf = getCsrfToken();
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
      res = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: "include",
        signal: combineSignal(userSignal),
      });
    }
  }

  if (!res.ok) {
    const errorData = await parseJsonSafe(res);
    const message = extractErrorMessage(errorData, res.statusText);
    // 422 maps to validation errors (FastAPI/Pydantic shape handled above).
    throw new ApiError(
      res.status === 422 && message === res.statusText
        ? "Validation failed"
        : message,
      res.status,
      errorData
    );
  }

  if (res.status === 204) return undefined as T;

  if (!isJsonResponse(res)) {
    return undefined as T;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

export async function downloadFile(
  endpoint: string,
  params?: Record<string, QueryValue>,
  userSignal?: AbortSignal
): Promise<{ blob: Blob; filename: string | null }> {
  const url = `${API_BASE_URL}${endpoint}${buildQuery(params)}`;

  // GET downloads must not send X-CSRF (avoids useless preflights; CSRF is
  // only for state-changing requests).
  const doFetch = async (signal: AbortSignal): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, { headers, credentials: "include", signal });
  };

  let res = await doFetch(combineSignal(userSignal));

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new ApiError("Unauthorized", 401, null);
    }
    res = await doFetch(combineSignal(userSignal));
  }

  if (!res.ok) {
    let errorData: unknown = null;
    try {
      if (isJsonResponse(res)) {
        errorData = await res.clone().json();
      }
    } catch {
      // binary error body — keep null
    }
    const msg = extractErrorMessage(errorData, res.statusText);
    throw new ApiError(msg, res.status, errorData);
  }
  const blob = await res.blob();
  const filename = parseFilenameFromDisposition(
    res.headers.get("content-disposition")
  );
  return { blob, filename };
}
