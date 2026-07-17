// Merged from two declarations in old api.ts (dashboard + admin)
// Dashboard uses: stage, count, total_value
// Admin uses: id, pipeline_id, name, position, color, probability, is_default
export interface PipelineStage {
  // Dashboard fields
  stage: string;
  count: number;
  total_value: number;
  // Admin fields
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color?: string;
  probability?: number;
  is_default: boolean;
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
