export interface Webhook {
  id: string;
  url: string;
  event: string;
  secret: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "success" | "failed";
  attempts: number;
  next_attempt_at: string;
  response_status: number | null;
  response_body: string | null;
  created_at: string;
  updated_at: string;
}
