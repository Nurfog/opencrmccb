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
