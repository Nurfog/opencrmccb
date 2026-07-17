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
