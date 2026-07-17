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
