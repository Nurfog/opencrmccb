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
