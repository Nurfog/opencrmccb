export { authApi } from "./auth";
export { contactsApi } from "./contacts";
export { companiesApi } from "./companies";
export { dealsApi } from "./deals";
export { dashboardApi } from "./dashboard";
export { activitiesApi } from "./activities";
export { documentsApi } from "./documents";
export { reportsApi } from "./reports";
export { searchApi } from "./search";
export { auditApi } from "./audit";
export { whatsAppApi } from "./whatsapp";
export { aiApi } from "./ai";
export { notificationsApi } from "./notifications";
export { tagsApi } from "./tags";
export { integrationsApi } from "./integrations";
export { adminApi } from "./admin";
export { webhooksApi } from "./webhooks";
export { leadsApi } from "./leads";
export { usersApi } from "./users";
export { emailApi } from "./email";
export { calendarApi } from "./calendar";

// Re-export token helpers used by auth store
export { setTokens, clearTokens, setLogoutHandler } from "../api-client";

// Re-export all types so components can import from "@/lib/api"
export type {
  User,
  AuthResponse,
  PaginatedResponse,
} from "../types/auth";
export type { Contact } from "../types/contact";
export type { Deal } from "../types/deal";
export type { Company } from "../types/company";
export type { Activity } from "../types/activity";
export type { Lead, LeadActivity, LeadStats } from "../types/lead";
export type { Document } from "../types/document";
export type {
  DashboardStats,
  PipelineStage,
  TopDeal,
  RecentActivity,
} from "../types/dashboard";
export type { AuditEvent } from "../types/audit";
export type { Notification, NotificationPreferences } from "../types/notification";
export type { Tag } from "../types/tag";
export type { EmailLog, EmailTemplate } from "../types/email";
export type { CalendarEvent } from "../types/calendar";
export type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppConversation,
  LeadAssignmentConfig,
} from "../types/whatsapp";
export type {
  Pipeline,
  PipelineWithStages,
  Profile,
  Branding,
} from "../types/admin";
export type { Webhook, WebhookDelivery } from "../types/webhook";
export type { SearchResult } from "../types/search";
export type { IntegrationStatus } from "../types/integrations";
export type { AIConfig, LeadExtraction } from "../types/ai";
