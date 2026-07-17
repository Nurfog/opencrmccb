export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

class ApiError extends Error {
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

async function request<T>(
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

// ---- Types (aligned with backend) ----
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_id?: string;
  permissions: string[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_id?: string;
  position?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  position?: number;
  contact_id?: string;
  company_id?: string;
  contact_name?: string;
  company_name?: string;
  expected_close_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_contacts: number;
  total_companies: number;
  total_deals: number;
  total_revenue: number;
  active_deals: number;
  won_deals: number;
  lost_deals: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  total_value: number;
}

export interface TopDeal {
  id: string;
  title: string;
  value: number;
  stage: string;
  company_name?: string;
}

export interface RecentActivity {
  id: string;
  activity_type: string;
  subject: string;
  contact_name?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  activity_type: string;
  subject: string;
  description?: string;
  contact_id?: string;
  deal_id?: string;
  company_id?: string;
  due_date?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  filename: string;
  original_name: string;
  mime_type?: string;
  file_size: number;
  folder?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  title?: string;
  industry?: string;
  website?: string;
  lead_source: string;
  status: string;
  score: number;
  assigned_to?: string;
  converted_at?: string;
  converted_contact_id?: string;
  converted_company_id?: string;
  converted_deal_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: string;
  subject: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  created_by?: string;
  created_at: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  conversion_rate: number;
  by_source: { source: string; count: number }[];
}

export interface EmailLog {
  id: string;
  from_email: string;
  to_email: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  body_html?: string;
  entity_type?: string;
  entity_id?: string;
  status: string;
  template_id?: string;
  sent_by?: string;
  sent_at?: string;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  body_html?: string;
  category: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  provider: string;
  external_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  attendees?: unknown;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResult {
  id: string;
  entity_type: string;
  label: string;
  subtitle: string;
}

// ---- Auth API ----
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

// ---- Contacts API ----
export const contactsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<PaginatedResponse<Contact>>("/api/v1/contacts", { params }),

  get: (id: string) => request<Contact>(`/api/v1/contacts/${id}`),

  create: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_id?: string;
    position?: string;
    notes?: string;
  }) =>
    request<Contact>("/api/v1/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/api/v1/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/contacts/${id}`, { method: "DELETE" }),

  exportCsv: (params?: { search?: string }) =>
    request<string>(`/api/v1/contacts/export`, { params }),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/contacts/import", {
      method: "POST",
      body,
    }),

  bulkDelete: (ids: string[]) =>
    request<{ deleted: number }>("/api/v1/contacts/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getDeals: (id: string) => request<Deal[]>(`/api/v1/contacts/${id}/deals`),
  getActivities: (id: string) => request<Activity[]>(`/api/v1/contacts/${id}/activities`),
};

// ---- Companies API ----
export const companiesApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<PaginatedResponse<Company>>("/api/v1/companies", { params }),

  get: (id: string) => request<Company>(`/api/v1/companies/${id}`),

  create: (data: {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
  }) =>
    request<Company>("/api/v1/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Company>) =>
    request<Company>(`/api/v1/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/companies/${id}`, { method: "DELETE" }),

  exportCsv: (params?: { search?: string }) =>
    request<string>(`/api/v1/companies/export`, { params }),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/companies/import", {
      method: "POST",
      body,
    }),

  getContacts: (id: string) => request<Contact[]>(`/api/v1/companies/${id}/contacts`),
  getDeals: (id: string) => request<Deal[]>(`/api/v1/companies/${id}/deals`),
  getRevenue: (id: string) => request<{ total_value: number; deal_count: number }>(`/api/v1/companies/${id}/revenue`),
};

// ---- Deals API ----
export const dealsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    stage?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<PaginatedResponse<Deal>>("/api/v1/deals", { params }),

  get: (id: string) => request<Deal>(`/api/v1/deals/${id}`),

  create: (data: {
    title: string;
    value: number;
    currency?: string;
    stage?: string;
    contact_id?: string;
    company_id?: string;
    expected_close_date?: string;
    notes?: string;
  }) =>
    request<Deal>("/api/v1/deals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Deal>) =>
    request<Deal>(`/api/v1/deals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/deals/${id}`, { method: "DELETE" }),

  updateStage: (id: string, data: { stage: string; position?: number }) =>
    request<Deal>(`/api/v1/deals/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  exportCsv: (params?: { search?: string }) =>
    request<string>(`/api/v1/deals/export`, { params }),

  importCsv: (body: string) =>
    request<{ imported: number; errors: string[] }>("/api/v1/deals/import", {
      method: "POST",
      body,
    }),

  getActivities: (id: string) => request<Activity[]>(`/api/v1/deals/${id}/activities`),
};

// ---- Dashboard API ----
export const dashboardApi = {
  stats: () =>
    request<DashboardStats>("/api/v1/dashboard/stats"),

  pipeline: () =>
    request<{ stages: PipelineStage[] }>("/api/v1/dashboard/pipeline"),

  topDeals: () =>
    request<{ deals: TopDeal[] }>("/api/v1/dashboard/top-deals"),

  recentActivities: () =>
    request<{ activities: RecentActivity[] }>("/api/v1/dashboard/recent-activities"),
};

// ---- Activities API ----
export const activitiesApi = {
  list: () =>
    request<Activity[]>("/api/v1/activities"),

  get: (id: string) =>
    request<Activity>(`/api/v1/activities/${id}`),

  create: (data: {
    activity_type: string;
    subject: string;
    description?: string;
    contact_id?: string;
    deal_id?: string;
    company_id?: string;
    due_date?: string;
  }) =>
    request<Activity>("/api/v1/activities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Activity>) =>
    request<Activity>(`/api/v1/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/activities/${id}`, { method: "DELETE" }),

  complete: (id: string) =>
    request<Activity>(`/api/v1/activities/${id}/complete`, { method: "POST" }),
};

// ---- Documents API ----
export const documentsApi = {
  list: (params?: {
    folder?: string;
    search?: string;
    mime_type?: string;
  }) => request<Document[]>("/api/v1/documents", { params }),

  upload: (formData: FormData) =>
    request<Document>("/api/v1/documents/upload", {
      method: "POST",
      body: formData,
    }),

  download: async (id: string): Promise<Blob | null> => {
    let token = accessToken;
    if (!token) {
      token = await refreshAccessToken();
      if (!token) return null;
    }
    const res = await fetch(`${API_BASE_URL}/api/v1/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) return null;
      const retry = await fetch(`${API_BASE_URL}/api/v1/documents/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!retry.ok) return null;
      return retry.blob();
    }
    if (!res.ok) return null;
    return res.blob();
  },

  delete: (id: string) =>
    request<void>(`/api/v1/documents/${id}`, { method: "DELETE" }),
};

// ---- Reports API ----
export const reportsApi = {
  pipeline: () =>
    request<{ stages: unknown[]; total_deals: number; total_value: number }>(
      "/api/v1/reports/pipeline"
    ),

  winLoss: () =>
    request<{
      won_count: number;
      lost_count: number;
      win_rate: number;
      loss_rate: number;
      won_value: number;
      lost_value: number;
      total_closed: number;
    }>("/api/v1/reports/win-loss"),
};

// ---- Search API ----
export const searchApi = {
  search: (params: { q: string }) =>
    request<{ contacts: SearchResult[]; companies: SearchResult[]; deals: SearchResult[] }>(
      "/api/v1/search",
      { params }
    ),
};

// ---- Audit API ----
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

// ---- WhatsApp API ----
export interface WhatsAppConfig {
  phone_number_id: string;
  business_account_id: string;
  phone_number?: string;
  is_active: boolean;
  webhook_verify_token?: string;
}

export interface WhatsAppMessage {
  id: string;
  direction: string;
  from_number: string;
  to_number: string;
  content: string;
  status: string;
  created_at: string;
}

export interface WhatsAppConversation {
  phone: string;
  contact_id?: string;
  contact_name?: string;
  last_message: string;
  last_message_at: string;
  last_direction: string;
}

export interface LeadAssignmentConfig {
  strategy: string;
  max_active_leads: number;
  territory_enabled: boolean;
  notify_on_assign: boolean;
}

export const whatsAppApi = {
  getConfig: () =>
    request<WhatsAppConfig>("/api/v1/integrations/whatsapp/config"),

  updateConfig: (data: {
    phone_number_id: string;
    business_account_id: string;
    api_token: string;
    phone_number?: string;
  }) =>
    request<WhatsAppConfig>("/api/v1/integrations/whatsapp/config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  sendMessage: (data: { to: string; content: string; contact_id?: string }) =>
    request<WhatsAppMessage>("/api/v1/integrations/whatsapp/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMessages: (contact_id?: string) =>
    request<WhatsAppMessage[]>(`/api/v1/integrations/whatsapp/messages${contact_id ? `?contact_id=${contact_id}` : ""}`),

  getConversations: () =>
    request<WhatsAppConversation[]>("/api/v1/integrations/whatsapp/conversations"),

  getLeadAssignmentConfig: () =>
    request<LeadAssignmentConfig>("/api/v1/settings/lead-assignment"),

  updateLeadAssignmentConfig: (data: Partial<LeadAssignmentConfig>) =>
    request<LeadAssignmentConfig>("/api/v1/settings/lead-assignment", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ---- AI / Lead Extraction API ----
export interface AIConfig {
  provider: string;
  api_url: string;
  model: string;
  is_active: boolean;
}

export interface LeadExtraction {
  id: string;
  phone_number: string;
  contact_id?: string;
  extracted_data: Record<string, unknown>;
  status: string;
  created_at: string;
}

export const aiApi = {
  getConfig: () =>
    request<AIConfig>("/api/v1/settings/ai"),

  updateConfig: (data: { provider?: string; api_url?: string; api_key?: string; model?: string }) =>
    request<AIConfig>("/api/v1/settings/ai", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  extractLead: (phone_number: string) =>
    request<LeadExtraction>("/api/v1/leads/extract", {
      method: "POST",
      body: JSON.stringify({ phone_number }),
    }),

  getExtractions: (phone_number?: string) =>
    request<LeadExtraction[]>(`/api/v1/leads/extractions${phone_number ? `?phone_number=${phone_number}` : ""}`),
};

// ---- Notifications API ----
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
}

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

// ---- Tags API ----
export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

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

// ---- Integrations API ----
export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  connected_at?: string;
  provider_email?: string;
  provider_name?: string;
}

export const integrationsApi = {
  list: () =>
    request<IntegrationStatus[]>("/api/v1/integrations"),

  connect: (provider: string) =>
    request<{ auth_url: string }>(`/api/v1/integrations/${provider}/connect`),

  disconnect: (provider: string) =>
    request<void>(`/api/v1/integrations/${provider}/disconnect`, { method: "DELETE" }),
};

// ---- Admin API (pipelines, profiles, branding) ----
export interface Pipeline {
  id: string;
  name: string;
  slug: string;
  description?: string;
  entity_type: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color?: string;
  probability?: number;
  is_default: boolean;
}

export interface PipelineWithStages {
  pipeline: Pipeline;
  stages: PipelineStage[];
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions: string[];
}

export interface Branding {
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  favicon_url?: string;
  custom_domain?: string;
}

export const adminApi = {
  listPipelines: () =>
    request<PipelineWithStages[]>("/api/v1/pipelines"),

  createPipeline: (data: { name: string; slug: string; description?: string; entity_type?: string }) =>
    request<Pipeline>("/api/v1/admin/pipelines", { method: "POST", body: JSON.stringify(data) }),

  updatePipeline: (id: string, data: { name: string; slug: string; description?: string; entity_type?: string }) =>
    request<Pipeline>(`/api/v1/admin/pipelines/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deletePipeline: (id: string) =>
    request<void>(`/api/v1/admin/pipelines/${id}`, { method: "DELETE" }),

  createStage: (pipelineId: string, data: { name: string; position: number; color?: string; probability?: number }) =>
    request<PipelineStage>(`/api/v1/admin/pipelines/${pipelineId}/stages`, { method: "POST", body: JSON.stringify(data) }),

  deleteStage: (pipelineId: string, stageId: string) =>
    request<void>(`/api/v1/admin/pipelines/${pipelineId}/stages/${stageId}`, { method: "DELETE" }),

  listProfiles: () =>
    request<Profile[]>("/api/v1/admin/profiles"),

  createProfile: (data: { name: string; description?: string; permissions?: string[] }) =>
    request<Profile>("/api/v1/admin/profiles", { method: "POST", body: JSON.stringify(data) }),

  updateProfile: (id: string, data: { name: string; description?: string; permissions?: string[] }) =>
    request<Profile>(`/api/v1/admin/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getBranding: () =>
    request<Branding>("/api/v1/branding"),

  updateBranding: (data: Partial<Branding>) =>
    request<Branding>("/api/v1/admin/branding", { method: "PUT", body: JSON.stringify(data) }),
};

// ---- Webhooks API ----
export const webhooksApi = {
  list: () => request<unknown[]>("/api/v1/webhooks"),

  create: (data: { url: string; event: string; secret?: string }) =>
    request<unknown>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/webhooks/${id}`, { method: "DELETE" }),
};

// ---- Leads API ----
export const leadsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    lead_source?: string;
    sort?: string;
    sort_dir?: string;
  }) => request<PaginatedResponse<Lead>>("/api/v1/leads", { params }),

  get: (id: string) => request<Lead>(`/api/v1/leads/${id}`),

  create: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    title?: string;
    industry?: string;
    website?: string;
    lead_source?: string;
    assigned_to?: string;
    notes?: string;
  }) =>
    request<Lead>("/api/v1/leads", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Lead>) =>
    request<Lead>(`/api/v1/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/leads/${id}`, { method: "DELETE" }),

  convert: (id: string, data: {
    pipeline_id: string;
    deal_title?: string;
    deal_value?: number;
  }) =>
    request<{ contact_id?: string; company_id?: string; deal_id?: string }>(
      `/api/v1/leads/${id}/convert`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  stats: () => request<LeadStats>("/api/v1/leads/stats"),

  getActivities: (id: string) =>
    request<LeadActivity[]>(`/api/v1/leads/${id}/activities`),

  createActivity: (id: string, data: {
    type: string;
    subject: string;
    description?: string;
    due_date?: string;
  }) =>
    request<LeadActivity>(`/api/v1/leads/${id}/activities`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeActivity: (leadId: string, activityId: string) =>
    request<void>(`/api/v1/leads/${leadId}/activities/${activityId}`, {
      method: "POST",
    }),

  deleteActivity: (leadId: string, activityId: string) =>
    request<void>(`/api/v1/leads/${leadId}/activities/${activityId}`, {
      method: "DELETE",
    }),
};

// ---- Users API (admin) ----
export const usersApi = {
  list: () => request<User[]>("/api/v1/users"),

  delete: (id: string) =>
    request<void>(`/api/v1/users/${id}`, { method: "DELETE" }),

  updateProfile: (id: string, profileId: string) =>
    request<User>(`/api/v1/users/${id}/profile`, {
      method: "PUT",
      body: JSON.stringify({ profile_id: profileId }),
    }),
};

// ---- Email API ----
export const emailApi = {
  send: (data: {
    from?: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    body_html?: string;
    entity_type?: string;
    entity_id?: string;
    template_id?: string;
  }) =>
    request<EmailLog>("/api/v1/email/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listLogs: (params?: { page?: number; per_page?: number }) =>
    request<PaginatedResponse<EmailLog>>("/api/v1/email/logs", { params }),

  getLog: (id: string) => request<EmailLog>(`/api/v1/email/logs/${id}`),

  listTemplates: () => request<EmailTemplate[]>("/api/v1/email/templates"),

  createTemplate: (data: {
    name: string;
    subject: string;
    body: string;
    body_html?: string;
    category?: string;
  }) =>
    request<EmailTemplate>("/api/v1/email/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: Partial<EmailTemplate>) =>
    request<EmailTemplate>(`/api/v1/email/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request<void>(`/api/v1/email/templates/${id}`, { method: "DELETE" }),

  sendFromTemplate: (templateId: string, data: {
    to: string;
    from?: string;
    entity_type?: string;
    entity_id?: string;
  }) =>
    request<EmailLog>(`/api/v1/email/send-from-template/${templateId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---- Calendar API ----
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

// ---- Notifications API ----
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    request<Notification[]>("/api/v1/notifications", { params }),

  getUnreadCount: () =>
    request<{ count: number }>("/api/v1/notifications/unread-count"),

  markAsRead: (id: string) =>
    request<void>(`/api/v1/notifications/${id}/read`, { method: "PUT" }),

  markAllAsRead: () =>
    request<void>("/api/v1/notifications/read-all", { method: "PUT" }),

  delete: (id: string) =>
    request<void>(`/api/v1/notifications/${id}`, { method: "DELETE" }),
};
