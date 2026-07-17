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
