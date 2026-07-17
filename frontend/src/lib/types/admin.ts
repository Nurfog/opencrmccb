import type { PipelineStage } from "./dashboard";

export interface Pipeline {
  id: string;
  name: string;
  slug: string;
  description?: string;
  entity_type: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PipelineWithStages {
  pipeline: Pipeline;
  stages: PipelineStage[];
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions: string[];
}

export interface Branding {
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  favicon_url?: string;
  custom_domain?: string;
}
