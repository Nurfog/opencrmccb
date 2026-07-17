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
