export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  connected_at?: string;
  provider_email?: string;
  provider_name?: string;
}
