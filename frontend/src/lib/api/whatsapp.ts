import { request } from "../api-client";
import type { WhatsAppConfig, WhatsAppMessage, WhatsAppConversation, LeadAssignmentConfig } from "../types";

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
