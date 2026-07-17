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
